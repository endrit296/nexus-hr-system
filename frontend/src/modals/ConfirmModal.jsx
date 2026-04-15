import './Modal.css';

function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay">
      <div className="modal-card modal-sm">
        <div className="modal-header">
          <h3 className="modal-title">{title || 'Are you sure?'}</h3>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
