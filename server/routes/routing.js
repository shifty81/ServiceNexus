const express = require('express');
const router = express.Router();
const db = require('../database');

// Calculate scores for all technicians using batch queries
async function getTechnicianScores() {
  const technicians = await db.query(
    `SELECT id, username, user_type FROM users WHERE user_type IN ('technician', 'admin')`
  );

  if (technicians.length === 0) return [];

  // Batch: workload counts per technician
  const workloads = await db.query(
    `SELECT assigned_to, COUNT(*) as count FROM service_calls
     WHERE status IN ('pending', 'in-progress') AND assigned_to IS NOT NULL
     GROUP BY assigned_to`
  );
  const workloadMap = Object.fromEntries(workloads.map(r => [r.assigned_to, r.count]));

  // Batch: completed and total counts per technician
  const callStats = await db.query(
    `SELECT assigned_to,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM service_calls
     WHERE assigned_to IS NOT NULL
     GROUP BY assigned_to`
  );
  const statsMap = Object.fromEntries(callStats.map(r => [r.assigned_to, r]));

  // Batch: average ratings per technician
  const ratings = await db.query(
    `SELECT technician_id, AVG(rating) as avg_rating FROM feedback
     WHERE technician_id IS NOT NULL
     GROUP BY technician_id`
  );
  const ratingMap = Object.fromEntries(ratings.map(r => [r.technician_id, r.avg_rating]));

  // Batch: active time entries (currently clocked in)
  const activeEntries = await db.query(
    `SELECT DISTINCT user_id FROM time_entries WHERE status = 'active'`
  );
  const busySet = new Set(activeEntries.map(r => r.user_id));

  const scores = technicians.map(tech => {
    const activeCallCount = workloadMap[tech.id] || 0;
    const stats = statsMap[tech.id] || { total: 0, completed: 0 };
    const completedCallCount = stats.completed;
    const completionRate = stats.total > 0
      ? (completedCallCount / stats.total) * 100
      : 100;
    const averageRating = ratingMap[tech.id] || 0;
    const availabilityStatus = busySet.has(tech.id) ? 'busy' : 'available';

    // Score components (each normalized 0-100)
    const maxWorkload = 10;
    const workloadScore = Math.max(0, 100 - (activeCallCount / maxWorkload) * 100);
    const availabilityScore = availabilityStatus === 'available' ? 100 : 0;
    const ratingScore = averageRating > 0 ? (averageRating / 5) * 100 : 50;
    const completionScore = completionRate;

    // Weighted overall score: workload 40%, availability 20%, rating 20%, completion 20%
    const overallScore = Math.round(
      workloadScore * 0.4 +
      availabilityScore * 0.2 +
      ratingScore * 0.2 +
      completionScore * 0.2
    );

    return {
      technician: { id: tech.id, username: tech.username, user_type: tech.user_type },
      activeCallCount,
      completedCallCount,
      completionRate: Math.round(completionRate * 100) / 100,
      averageRating: Math.round(averageRating * 100) / 100,
      availabilityStatus,
      overallScore,
      factors: {
        workloadScore: Math.round(workloadScore),
        availabilityScore,
        ratingScore: Math.round(ratingScore),
        completionScore: Math.round(completionScore)
      }
    };
  });

  // Sort by overall score descending
  scores.sort((a, b) => b.overallScore - a.overallScore);
  return scores;
}

// Assign a single service call to the best technician
async function assignServiceCall(serviceCallId, app) {
  const serviceCall = await db.get(
    `SELECT * FROM service_calls WHERE id = ?`,
    [serviceCallId]
  );

  if (!serviceCall) {
    return { error: 'Service call not found', status: 404 };
  }

  if (serviceCall.assigned_to) {
    return { error: 'Service call is already assigned', status: 400 };
  }

  const scores = await getTechnicianScores();

  if (scores.length === 0) {
    return { error: 'No technicians available', status: 400 };
  }

  const bestTechnician = scores[0];

  await db.run(
    `UPDATE service_calls SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [bestTechnician.technician.id, serviceCallId]
  );

  const updatedCall = await db.get(
    `SELECT sc.*, u.username as assigned_to_name
     FROM service_calls sc
     LEFT JOIN users u ON sc.assigned_to = u.id
     WHERE sc.id = ?`,
    [serviceCallId]
  );

  // Emit socket event
  if (app.get('io')) {
    app.get('io').emit('service-call-changed', updatedCall);
  }

  return {
    serviceCall: updatedCall,
    assignedTo: bestTechnician.technician,
    score: bestTechnician.overallScore,
    factors: bestTechnician.factors
  };
}

// GET / — Routing suggestions for unassigned pending service calls
router.get('/', async (req, res) => {
  try {
    const unassignedCalls = await db.query(
      `SELECT sc.*, c.contact_name as customer_name
       FROM service_calls sc
       LEFT JOIN customers c ON sc.customer_id = c.id
       WHERE sc.assigned_to IS NULL AND sc.status = 'pending'
       ORDER BY sc.created_at ASC`
    );

    if (unassignedCalls.length === 0) {
      return res.json([]);
    }

    const scores = await getTechnicianScores();

    if (scores.length === 0) {
      return res.json([]);
    }

    // Distribute suggestions across technicians by rotating through ranked list
    const suggestions = unassignedCalls.map((call, index) => {
      const techIndex = index % scores.length;
      return {
        serviceCall: call,
        suggestedTechnician: scores[techIndex].technician,
        score: scores[techIndex].overallScore,
        factors: scores[techIndex].factors
      };
    });

    res.json(suggestions);
  } catch (error) {
    console.error('Error getting routing suggestions:', error);
    res.status(500).json({ error: 'Failed to get routing suggestions' });
  }
});

// POST /auto-assign — Auto-assign a specific service call
router.post('/auto-assign', async (req, res) => {
  try {
    const { service_call_id } = req.body;

    if (!service_call_id) {
      return res.status(400).json({ error: 'service_call_id is required' });
    }

    const result = await assignServiceCall(service_call_id, req.app);

    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error auto-assigning service call:', error);
    res.status(500).json({ error: 'Failed to auto-assign service call' });
  }
});

// POST /auto-assign-all — Auto-assign all unassigned pending service calls
router.post('/auto-assign-all', async (req, res) => {
  try {
    const unassignedCalls = await db.query(
      `SELECT id FROM service_calls
       WHERE assigned_to IS NULL AND status = 'pending'
       ORDER BY created_at ASC`
    );

    if (unassignedCalls.length === 0) {
      return res.json({ assignments: [], message: 'No unassigned service calls found' });
    }

    const assignments = [];

    for (const call of unassignedCalls) {
      const result = await assignServiceCall(call.id, req.app);
      if (!result.error) {
        assignments.push(result);
      }
    }

    res.json({ assignments, totalAssigned: assignments.length });
  } catch (error) {
    console.error('Error auto-assigning all service calls:', error);
    res.status(500).json({ error: 'Failed to auto-assign service calls' });
  }
});

// GET /technician-scores — Current scores for all technicians
router.get('/technician-scores', async (req, res) => {
  try {
    const scores = await getTechnicianScores();
    res.json(scores);
  } catch (error) {
    console.error('Error fetching technician scores:', error);
    res.status(500).json({ error: 'Failed to fetch technician scores' });
  }
});

module.exports = router;
