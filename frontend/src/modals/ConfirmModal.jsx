import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

function ConfirmModal({ title, message, onConfirm, onCancel, loading }) {
  return (
    <Modal
      isOpen
      onClose={onCancel}
      title={title || 'Are you sure?'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      <p className="text-slate-600 text-sm leading-relaxed">{message}</p>
    </Modal>
  );
}

export default ConfirmModal;
