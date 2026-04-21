import { useState } from 'react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

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
    <Modal
      isOpen
      onClose={onClose}
      title="Add Department"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Department Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Engineering"
          error={error}
          autoFocus
        />
      </form>
    </Modal>
  );
}

export default DepartmentModal;
