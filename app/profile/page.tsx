'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { Sidebar } from '@/components/sidebar';
import { TopBar } from '@/components/top-bar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useState, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Camera, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePage() {
  const { userData, user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const initials = (userData?.fullName || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (JPG, PNG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB to keep Firestore document size reasonable)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 2MB',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string;

          // Update Firestore
          if (user?.uid) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              profilePicture: base64String,
              updatedAt: new Date(),
            });

            toast({
              title: 'Success',
              description: 'Profile picture updated successfully',
            });
          }
        } catch (error) {
          console.error('Error updating profile picture:', error);
          toast({
            title: 'Upload failed',
            description: 'Failed to update profile picture. Please try again.',
            variant: 'destructive',
          });
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        toast({
          title: 'Upload failed',
          description: 'Failed to read the image file',
          variant: 'destructive',
        });
        setUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Upload failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      setUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex">
        <Sidebar />

        <main className="flex-1 bg-background md:ml-64">
          {/* Top Bar */}
          <TopBar />

          <div className="p-6 md:p-8 max-w-2xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">
                My Profile
              </h1>
              <p className="text-muted-foreground mt-2">
                View and manage your account information
              </p>
            </div>

            {/* Profile Card */}
            <Card className="p-8 space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <div className="relative group">
                  <Avatar className="w-24 h-24">
                    <AvatarImage
                      src={userData?.profilePicture || "/placeholder.jpeg"}
                      alt={userData?.fullName}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xl">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Upload overlay */}
                  <button
                    onClick={handleImageClick}
                    disabled={uploading}
                    className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </button>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-foreground">
                    {userData?.fullName}
                  </h2>
                  <p className="text-muted-foreground">{userData?.email}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {userData?.role}
                    </span>
                    {userData?.isApprover && (
                      <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                        Approver
                      </span>
                    )}
                  </div>
                  
                  {/* Upload button for mobile */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImageClick}
                    disabled={uploading}
                    className="mt-3 md:hidden"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Change Photo
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Employment Information
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Full Name
                    </label>
                    <Input
                      type="text"
                      value={userData?.fullName || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={userData?.email || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Position
                    </label>
                    <Input
                      type="text"
                      value={userData?.position || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Department
                    </label>
                    <Input
                      type="text"
                      value={userData?.department || ''}
                      disabled
                      className="bg-secondary"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Account Status
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your account information is managed by IT Administrator.
                  Contact your IT Officer to request changes.
                </p>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}