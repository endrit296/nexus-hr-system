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
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-2xl">⚠️</div>
        <p className="text-slate-600 text-base leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
}

export default ConfirmModal;
