import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';

const EmployeesPage = () => {
    const [employees, setEmployees] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '' });

    const [formData, setFormData] = useState({
        name: '',
        position: '',
        email: '',
        salary: ''
    });

    // Shfaqja e Toast-it
    const showToast = (msg) => {
        setToast({ show: true, message: msg });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const fetchEmployees = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/employees');
            setEmployees(response.data);
        } catch (error) {
            console.error("Gabim gjatë marrjes së të dhënave:", error);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // VALIDIMET
        if (!formData.name || !formData.position || !formData.email || !formData.salary) {
            alert("Ju lutem plotësoni të gjitha fushat!");
            return;
        }

        if (formData.salary <= 0) {
            alert("Paga duhet të jetë një numër pozitiv!");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            alert("Ju lutem shkruani një email valide!");
            return;
        }

        try {
            if (isEditMode) {
                await axios.put(`http://localhost:5000/api/employees/${selectedEmployee._id}`, formData);
                showToast("Punëtori u përditësua me sukses! ✅");
            } else {
                await axios.post('http://localhost:5000/api/employees', formData);
                showToast("Punëtori u shtua me sukses! ✅");
            }
            setIsModalOpen(false);
            resetForm();
            fetchEmployees();
        } catch (error) {
            alert("Ndodhi një gabim: " + error.response?.data?.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("A jeni të sigurt që dëshironi ta fshini këtë punëtor?")) {
            try {
                await axios.delete(`http://localhost:5000/api/employees/${id}`);
                showToast("Punëtori u fshi me sukses! 🗑️");
                fetchEmployees();
            } catch (error) {
                console.error("Gabim gjatë fshirjes:", error);
            }
        }
    };

    const openAddModal = () => {
        setIsEditMode(false);
        resetForm();
        setIsModalOpen(true);
    };

    const openEditModal = (emp) => {
        setIsEditMode(true);
        setSelectedEmployee(emp);
        setFormData({
            name: emp.name,
            position: emp.position,
            email: emp.email,
            salary: emp.salary
        });
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({ name: '', position: '', email: '', salary: '' });
        setSelectedEmployee(null);
    };

    return (
        <div className="container">
            {/* Toast Notification */}
            {toast.show && <div className="toast-notification">{toast.message}</div>}

            <div className="header">
                <h2>Menaxhimi i Punëtorëve</h2>
                <button className="btn-add" onClick={openAddModal}>+ Shto Punëtor</button>
            </div>

            <table className="employee-table">
                <thead>
                    <tr>
                        <th>Emri</th>
                        <th>Pozita</th>
                        <th>Email</th>
                        <th>Paga</th>
                        <th>Veprimet</th>
                    </tr>
                </thead>
                <tbody>
                    {employees.map((emp) => (
                        <tr key={emp._id}>
                            <td>{emp.name}</td>
                            <td>{emp.position}</td>
                            <td>{emp.email}</td>
                            <td>{emp.salary}€</td>
                            <td>
                                <button className="btn-edit" onClick={() => openEditModal(emp)}>Ndrysho</button>
                                <button className="btn-delete" onClick={() => handleDelete(emp._id)}>Fshij</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>{isEditMode ? "Ndrysho Punëtorin" : "Shto Punëtor të Ri"}</h3>
                        <form onSubmit={handleSubmit}>
                            <input type="text" name="name" placeholder="Emri i plotë" value={formData.name} onChange={handleInputChange} />
                            <input type="text" name="position" placeholder="Pozita" value={formData.position} onChange={handleInputChange} />
                            <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleInputChange} />
                            <input type="number" name="salary" placeholder="Paga" value={formData.salary} onChange={handleInputChange} />
                            <div className="modal-actions">
                                <button type="submit" className="btn-save">{isEditMode ? "Ruaj Ndryshimet" : "Shto"}</button>
                                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>Anulo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeesPage;