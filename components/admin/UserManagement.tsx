'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { db, auth } from '@/lib/firebase';
import { setDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UserRecord {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  position: string;
  department: string;
  role: 'Employee' | 'Admin';
  isApprover: boolean;
}

interface UserManagementProps {
  users: UserRecord[];
  setUsers: React.Dispatch<React.SetStateAction<UserRecord[]>>;
  loading: boolean;
}

export function UserManagement({ users, setUsers, loading }: UserManagementProps) {
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [userFormData, setUserFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    position: '',
    department: '',
    role: 'Employee' as 'Employee' | 'Admin',
    isApprover: false,
  });

  const handleSaveUser = async () => {
    if (
      !userFormData.email ||
      !userFormData.fullName ||
      !userFormData.position ||
      !userFormData.department
    ) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userFormData.email.trim())) {
      alert('Please enter a valid email address');
      return;
    }

    if (!editingUser && !userFormData.password) {
      alert('Password is required for new employees');
      return;
    }

    if (userFormData.password && userFormData.password.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    try {
      setSaving(true);

      if (editingUser) {
        const updateData: any = {
          email: userFormData.email.trim(),
          fullName: userFormData.fullName,
          position: userFormData.position,
          department: userFormData.department,
          role: userFormData.role,
          isApprover: userFormData.isApprover,
          updatedAt: new Date().toISOString(),
        };

        await updateDoc(doc(db, 'users', editingUser.id), updateData);

        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id ? { ...u, ...userFormData } : u
          )
        );

        alert('Employee updated successfully!');
      } else {
        let newUserId: string;

        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            userFormData.email.trim(),
            userFormData.password
          );
          newUserId = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            alert('This email is already registered. Please use a different email.');
          } else if (authError.code === 'auth/weak-password') {
            alert('Password is too weak. Please use a stronger password.');
          } else if (authError.code === 'auth/invalid-email') {
            alert('Invalid email format. Please enter a valid email address.');
          } else {
            alert(
              `Authentication error: ${authError.message || 'Failed to create user'}`
            );
          }
          return;
        }

        await setDoc(doc(db, 'users', newUserId), {
          email: userFormData.email.trim(),
          fullName: userFormData.fullName,
          position: userFormData.position,
          department: userFormData.department,
          role: userFormData.role,
          isApprover: userFormData.isApprover,
          createdAt: new Date().toISOString(),
        });

        const newUser: UserRecord = {
          id: newUserId,
          ...userFormData,
        };
        setUsers((prev) => [...prev, newUser]);

        alert(
          'Employee added successfully! Their login credentials have been created in Firebase Authentication.'
        );
      }

      setShowUserForm(false);
      setEditingUser(null);
      setUserFormData({
        email: '',
        password: '',
        fullName: '',
        position: '',
        department: '',
        role: 'Employee',
        isApprover: false,
      });
      setShowPassword(false);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving employee. Please check console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !window.confirm(
        'Are you sure you want to delete this employee? This will also delete their login credentials.'
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', userId));
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      alert('Employee deleted successfully!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting employee. Please check console for details.');
    }
  };

  const handleToggleApprover = async (userId: string, isApprover: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        isApprover: !isApprover,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isApprover: !isApprover } : u
        )
      );
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Error updating approver status. Please check console for details.');
    }
  };

  const openEditUser = (user: UserRecord) => {
    setEditingUser(user);
    setUserFormData({
      email: user.email,
      password: '',
      fullName: user.fullName,
      position: user.position,
      department: user.department,
      role: user.role,
      isApprover: user.isApprover,
    });
    setShowUserForm(true);
    setShowPassword(false);
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-foreground">
            Employee Directory
          </h2>
          <Button
            onClick={() => {
              setEditingUser(null);
              setUserFormData({
                email: '',
                password: '',
                fullName: '',
                position: '',
                department: '',
                role: 'Employee',
                isApprover: false,
              });
              setShowUserForm(true);
              setShowPassword(false);
            }}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus size={18} className="mr-2" />
            Add Employee
          </Button>
        </div>

        {loading ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Loading users...</p>
          </Card>
        ) : users.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              No users found. Add your first employee!
            </p>
          </Card>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary border-b border-border">
                    <th className="text-left py-4 px-6 font-semibold text-foreground">
                      Name
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-foreground">
                      Email
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-foreground">
                      Position
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-foreground">
                      Role
                    </th>
                    <th className="text-left py-4 px-6 font-semibold text-foreground">
                      Approver
                    </th>
                    <th className="text-right py-4 px-6 font-semibold text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-4 px-6 text-foreground font-medium">
                        {user.fullName}
                      </td>
                      <td className="py-4 px-6 text-muted-foreground text-xs">
                        {user.email}
                      </td>
                      <td className="py-4 px-6 text-foreground">
                        {user.position}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            user.role === 'Admin'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() =>
                            handleToggleApprover(user.id, user.isApprover)
                          }
                          className="p-2 hover:bg-secondary rounded-lg transition-colors"
                        >
                          {user.isApprover ? (
                            <CheckCircle size={20} className="text-green-600" />
                          ) : (
                            <XCircle size={20} className="text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditUser(user)}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors"
                          >
                            <Edit2
                              size={16}
                              className="text-muted-foreground"
                            />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          >
                            <Trash2
                              size={16}
                              className="text-destructive"
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {users.map((user) => (
                <Card key={user.id} className="p-4">
                  <h3 className="font-bold text-foreground mb-2">
                    {user.fullName}
                  </h3>
                  <div className="space-y-1 text-xs text-muted-foreground mb-3">
                    <p>{user.email}</p>
                    <p>{user.position}</p>
                    <p>
                      Role:{' '}
                      <span
                        className={
                          user.role === 'Admin'
                            ? 'text-purple-700'
                            : 'text-blue-700'
                        }
                      >
                        {user.role}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleToggleApprover(user.id, user.isApprover)
                      }
                      className="flex-1"
                    >
                      {user.isApprover ? 'Remove Approver' : 'Make Approver'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditUser(user)}
                    >
                      <Edit2 size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      {/* User Form Modal */}
      <Dialog open={showUserForm} onOpenChange={setShowUserForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Edit Employee' : 'Add Employee'}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update employee information'
                : 'Create a new employee account'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name *
              </label>
              <Input
                type="text"
                value={userFormData.fullName}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, fullName: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email *
              </label>
              <Input
                type="email"
                value={userFormData.email}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, email: e.target.value })
                }
                placeholder="john@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Password {editingUser ? '(Leave blank to keep current)' : '*'}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={userFormData.password}
                  onChange={(e) =>
                    setUserFormData({
                      ...userFormData,
                      password: e.target.value,
                    })
                  }
                  placeholder={editingUser ? 'Enter new password' : 'Enter password'}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Minimum 6 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Position *
              </label>
              <Input
                type="text"
                value={userFormData.position}
                onChange={(e) =>
                  setUserFormData({ ...userFormData, position: e.target.value })
                }
                placeholder="Senior Developer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Department *
              </label>
              <Input
                type="text"
                value={userFormData.department}
                onChange={(e) =>
                  setUserFormData({
                    ...userFormData,
                    department: e.target.value,
                  })
                }
                placeholder="Engineering"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Role *
              </label>
              <select
                value={userFormData.role}
                onChange={(e) =>
                  setUserFormData({
                    ...userFormData,
                    role: e.target.value as 'Employee' | 'Admin',
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="Employee">Employee</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isApprover"
                checked={userFormData.isApprover}
                onChange={(e) =>
                  setUserFormData({
                    ...userFormData,
                    isApprover: e.target.checked,
                  })
                }
                className="w-4 h-4 text-primary rounded focus:ring-2 focus:ring-primary"
              />
              <label htmlFor="isApprover" className="ml-2 text-sm text-foreground">
                Is Approver
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={() => setShowUserForm(false)}
              variant="outline"
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveUser}
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editingUser
                  ? 'Update Employee'
                  : 'Add Employee'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}