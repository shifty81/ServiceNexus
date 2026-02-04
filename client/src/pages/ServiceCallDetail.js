import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ServiceCallDetail.css';

function ServiceCallDetail({ socket }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [serviceCall, setServiceCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [pictureFile, setPictureFile] = useState(null);
  const [pictureComment, setPictureComment] = useState('');
  const [qrCodeData, setQrCodeData] = useState('');
  const [activeCheckIn, setActiveCheckIn] = useState(null);
  const [showEquipmentModal, setShowEquipmentModal] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    serial_number: '',
    model: '',
    manufacturer: '',
    location_details: '',
    notes: ''
  });
  const fileInputRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const userType = currentUser?.user_type || 'admin';

  useEffect(() => {
    loadServiceCall();
    if (userType === 'technician') {
      loadActiveCheckIn();
    }

    if (socket) {
      socket.on('service-call-comment-added', (data) => {
        if (data.serviceCallId === id) {
          loadServiceCall();
        }
      });
      socket.on('picture-uploaded', (data) => {
        if (data.serviceCallId === id) {
          loadServiceCall();
        }
      });
      socket.on('equipment-added', () => {
        loadServiceCall();
      });
    }

    return () => {
      if (socket) {
        socket.off('service-call-comment-added');
        socket.off('picture-uploaded');
        socket.off('equipment-added');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, socket, userType]);

  const loadServiceCall = async () => {
    try {
      const response = await axios.get(`/api/servicecalls/${id}`);
      setServiceCall(response.data);
    } catch (error) {
      console.error('Error loading service call:', error);
      alert('Failed to load service call');
      navigate('/servicecalls');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveCheckIn = async () => {
    try {
      const response = await axios.get(`/api/qrcodes/active/${currentUser.id}`);
      setActiveCheckIn(response.data);
    } catch (error) {
      console.error('Error loading active check-in:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await axios.post(`/api/servicecalls/${id}/comments`, {
        user_id: currentUser.id,
        comment: comment.trim()
      });
      setComment('');
      loadServiceCall();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setPictureFile(file);
    }
  };

  const handleUploadPicture = async (e) => {
    e.preventDefault();
    if (!pictureFile) return;

    try {
      const formData = new FormData();
      formData.append('picture', pictureFile);
      formData.append('service_call_id', id);
      formData.append('uploaded_by', currentUser.id);
      formData.append('comment', pictureComment);

      await axios.post('/api/pictures/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setPictureFile(null);
      setPictureComment('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      loadServiceCall();
    } catch (error) {
      console.error('Error uploading picture:', error);
      alert('Failed to upload picture');
    }
  };

  const handleCheckIn = async () => {
    if (!qrCodeData.trim()) {
      alert('Please scan or enter a QR code');
      return;
    }

    try {
      // Validate QR code first
      const validateResponse = await axios.post('/api/qrcodes/validate', {
        qr_code_data: qrCodeData
      });

      if (!validateResponse.data) {
        alert('Invalid QR code');
        return;
      }

      // Check in
      await axios.post('/api/qrcodes/checkin', {
        service_call_id: id,
        technician_id: currentUser.id,
        qr_code_id: validateResponse.data.id,
        notes: `Checked in at ${validateResponse.data.location_name || 'location'}`
      });

      setQrCodeData('');
      loadActiveCheckIn();
      loadServiceCall();
      alert('Checked in successfully!');
    } catch (error) {
      console.error('Error checking in:', error);
      alert(error.response?.data?.error || 'Failed to check in');
    }
  };

  const handleCheckOut = async () => {
    if (!activeCheckIn) return;

    try {
      await axios.post(`/api/qrcodes/checkout/${activeCheckIn.id}`, {
        notes: 'Checked out'
      });

      setActiveCheckIn(null);
      loadServiceCall();
      alert('Checked out successfully!');
    } catch (error) {
      console.error('Error checking out:', error);
      alert('Failed to check out');
    }
  };

  const handleAddEquipment = async (e) => {
    e.preventDefault();

    try {
      await axios.post('/api/equipment', {
        service_call_id: id,
        customer_id: serviceCall.customer_id,
        ...equipmentForm
      });

      setShowEquipmentModal(false);
      setEquipmentForm({
        name: '',
        serial_number: '',
        model: '',
        manufacturer: '',
        location_details: '',
        notes: ''
      });
      loadServiceCall();
    } catch (error) {
      console.error('Error adding equipment:', error);
      alert('Failed to add equipment');
    }
  };

  if (loading) {
    return <div className="container"><div className="loading">Loading service call...</div></div>;
  }

  if (!serviceCall) {
    return <div className="container"><div className="error">Service call not found</div></div>;
  }

  return (
    <div className="container service-call-detail">
      <div className="detail-header">
        <button className="btn btn-secondary" onClick={() => navigate('/servicecalls')}>
          ← Back
        </button>
        <h1>{serviceCall.title}</h1>
      </div>

      <div className="detail-grid">
        {/* Main Info Card */}
        <div className="card">
          <h2>Service Call Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Status:</label>
              <span className="badge" style={{ backgroundColor: getStatusColor(serviceCall.status) }}>
                {serviceCall.status}
              </span>
            </div>
            <div className="info-item">
              <label>Priority:</label>
              <span className="badge" style={{ backgroundColor: getPriorityColor(serviceCall.priority) }}>
                {serviceCall.priority}
              </span>
            </div>
            {serviceCall.customer_name && (
              <div className="info-item">
                <label>Customer:</label>
                <span>{serviceCall.customer_name}</span>
              </div>
            )}
            {serviceCall.company_name && (
              <div className="info-item">
                <label>Company:</label>
                <span>{serviceCall.company_name}</span>
              </div>
            )}
            {serviceCall.assigned_to_name && (
              <div className="info-item">
                <label>Assigned To:</label>
                <span>{serviceCall.assigned_to_name}</span>
              </div>
            )}
            {serviceCall.due_date && (
              <div className="info-item">
                <label>Due Date:</label>
                <span>{new Date(serviceCall.due_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          {serviceCall.description && (
            <div className="description">
              <label>Description:</label>
              <p>{serviceCall.description}</p>
            </div>
          )}
        </div>

        {/* Check-In/Out Card (Technician only) */}
        {userType === 'technician' && (
          <div className="card">
            <h2>📍 Check In/Out</h2>
            {activeCheckIn && activeCheckIn.service_call_id === id ? (
              <div className="check-in-active">
                <p>✅ Currently checked in</p>
                <p><small>Since: {new Date(activeCheckIn.check_in_time).toLocaleString()}</small></p>
                <button className="btn btn-danger" onClick={handleCheckOut}>
                  Check Out
                </button>
              </div>
            ) : (
              <div className="check-in-form">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Scan or enter QR code"
                  value={qrCodeData}
                  onChange={(e) => setQrCodeData(e.target.value)}
                />
                <button className="btn btn-primary" onClick={handleCheckIn}>
                  Check In
                </button>
              </div>
            )}
          </div>
        )}

        {/* Comments Section */}
        <div className="card comments-card">
          <h2>💬 Comments</h2>
          <div className="comments-list">
            {serviceCall.comments && serviceCall.comments.length > 0 ? (
              serviceCall.comments.map(c => (
                <div key={c.id} className="comment">
                  <div className="comment-header">
                    <strong>{c.username}</strong>
                    <span className="comment-type">({c.user_type})</span>
                    <span className="comment-time">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p>{c.comment}</p>
                </div>
              ))
            ) : (
              <p className="empty-message">No comments yet</p>
            )}
          </div>

          <form onSubmit={handleAddComment} className="comment-form">
            <textarea
              className="form-control"
              rows="3"
              placeholder="Add a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary">
              Post Comment
            </button>
          </form>
        </div>

        {/* Pictures Section (Technician and Admin) */}
        {(userType === 'technician' || userType === 'admin') && (
          <div className="card">
            <h2>📷 Site Pictures</h2>
            <div className="pictures-grid">
              {serviceCall.pictures && serviceCall.pictures.length > 0 ? (
                serviceCall.pictures.map(pic => (
                  <div key={pic.id} className="picture-card">
                    <div className="picture-meta">
                      <small>By: {pic.username}</small>
                      <small>{new Date(pic.uploaded_at).toLocaleString()}</small>
                    </div>
                    {pic.serial_numbers && JSON.parse(pic.serial_numbers).length > 0 && (
                      <div className="serial-numbers">
                        <strong>Serial Numbers Found:</strong>
                        {JSON.parse(pic.serial_numbers).map((sn, idx) => (
                          <span key={idx} className="badge badge-info">{sn}</span>
                        ))}
                      </div>
                    )}
                    {pic.comment && <p>{pic.comment}</p>}
                  </div>
                ))
              ) : (
                <p className="empty-message">No pictures uploaded yet</p>
              )}
            </div>

            <form onSubmit={handleUploadPicture} className="upload-form">
              <div className="form-group">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileSelect}
                  required
                />
                {pictureFile && (
                  <div className="file-preview">
                    Selected: {pictureFile.name}
                  </div>
                )}
              </div>
              <div className="form-group">
                <textarea
                  className="form-control"
                  rows="2"
                  placeholder="Add comment (include serial numbers for AI extraction)..."
                  value={pictureComment}
                  onChange={(e) => setPictureComment(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={!pictureFile}>
                Upload Picture
              </button>
            </form>
          </div>
        )}

        {/* Equipment Section */}
        <div className="card">
          <div className="card-header-with-action">
            <h2>🔧 Equipment</h2>
            {(userType === 'technician' || userType === 'admin') && (
              <button className="btn btn-sm btn-primary" onClick={() => setShowEquipmentModal(true)}>
                + Add Equipment
              </button>
            )}
          </div>

          <div className="equipment-list">
            {serviceCall.equipment && serviceCall.equipment.length > 0 ? (
              serviceCall.equipment.map(eq => (
                <div key={eq.id} className="equipment-item">
                  <h4>{eq.name}</h4>
                  {eq.serial_number && <p><strong>SN:</strong> {eq.serial_number}</p>}
                  {eq.model && <p><strong>Model:</strong> {eq.model}</p>}
                  {eq.manufacturer && <p><strong>Mfr:</strong> {eq.manufacturer}</p>}
                  {eq.location_details && <p><strong>Location:</strong> {eq.location_details}</p>}
                  {eq.notes && <p><small>{eq.notes}</small></p>}
                </div>
              ))
            ) : (
              <p className="empty-message">No equipment recorded yet</p>
            )}
          </div>
        </div>

        {/* Check-In History */}
        {serviceCall.checkIns && serviceCall.checkIns.length > 0 && (
          <div className="card">
            <h2>📋 Check-In History</h2>
            <div className="checkin-list">
              {serviceCall.checkIns.map(ci => (
                <div key={ci.id} className="checkin-item">
                  <p><strong>{ci.technician_name}</strong></p>
                  <p>Check-in: {new Date(ci.check_in_time).toLocaleString()}</p>
                  {ci.check_out_time && (
                    <p>Check-out: {new Date(ci.check_out_time).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Equipment Modal */}
      {showEquipmentModal && (
        <div className="modal-overlay" onClick={() => setShowEquipmentModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Equipment</h2>
              <button className="modal-close" onClick={() => setShowEquipmentModal(false)}>×</button>
            </div>

            <form onSubmit={handleAddEquipment}>
              <div className="form-group">
                <label className="form-label">Equipment Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({...equipmentForm, name: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Serial Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={equipmentForm.serial_number}
                  onChange={(e) => setEquipmentForm({...equipmentForm, serial_number: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Model</label>
                <input
                  type="text"
                  className="form-control"
                  value={equipmentForm.model}
                  onChange={(e) => setEquipmentForm({...equipmentForm, model: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Manufacturer</label>
                <input
                  type="text"
                  className="form-control"
                  value={equipmentForm.manufacturer}
                  onChange={(e) => setEquipmentForm({...equipmentForm, manufacturer: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Location Details</label>
                <input
                  type="text"
                  className="form-control"
                  value={equipmentForm.location_details}
                  onChange={(e) => setEquipmentForm({...equipmentForm, location_details: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={equipmentForm.notes}
                  onChange={(e) => setEquipmentForm({...equipmentForm, notes: e.target.value})}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEquipmentModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Equipment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusColor(status) {
  const colors = {
    pending: '#ffc107',
    'in-progress': '#17a2b8',
    completed: '#28a745',
    cancelled: '#6c757d'
  };
  return colors[status] || '#6c757d';
}

function getPriorityColor(priority) {
  const colors = {
    low: '#28a745',
    normal: '#17a2b8',
    high: '#ffc107',
    urgent: '#dc3545'
  };
  return colors[priority] || '#17a2b8';
}

export default ServiceCallDetail;
