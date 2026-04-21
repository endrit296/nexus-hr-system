import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

const departmentSchema = z.object({
  name:        z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
});

function DepartmentModal({ onClose, onSave, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(departmentSchema),
    mode: 'onChange',
  });

  const onSubmit = (data) => {
    onSave({ name: data.name.trim(), ...(data.description ? { description: data.description.trim() } : {}) });
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
          <Button variant="primary" onClick={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Department Name"
          placeholder="e.g. Engineering"
          error={errors.name?.message}
          autoFocus
          {...register('name')}
        />
        <Input
          label="Description"
          placeholder="Optional description"
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Modal>
  );
}

export default DepartmentModal;
