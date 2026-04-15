import { useState } from 'react';
import './Modal.css';

function DepartmentModal({ onClose, onSave, loading }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError('Department name is required'); return; }
    setError('');
    onSave({ name: name.trim() });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-sm">
        <div className="modal-header">
          <h3 className="modal-title">Add Department</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Department Name *</label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Engineering"
                autoFocus
              />
            </div>
            {error && <p className="form-error" style={{ marginTop: 8 }}>{error}</p>}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default DepartmentModal;
