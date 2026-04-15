import React, { createContext, useState, useEffect, useContext } from 'react';

// 1. Krijojmë Context-in
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Kontrollojmë nëse ka një përdorues të ruajtur në LocalStorage kur hapet faqja
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    // Funksioni për Login
    const login = (userData) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData)); // Ruajmë të dhënat dhe Token-in
    };

    // Funksioni për Logout
    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

// Hook-u që do ta përdorësh nëpër faqe (p.sh. te Sidebar apo Login)
export const useAuth = () => useContext(AuthContext);
