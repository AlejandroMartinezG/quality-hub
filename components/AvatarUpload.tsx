"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Loader2, Upload, X } from "lucide-react"
import { toast } from "sonner"

interface AvatarUploadProps {
    userId: string
    currentAvatarUrl?: string | null
    userName: string
    onUploadComplete?: (url: string) => void
}

export function AvatarUpload({ userId, currentAvatarUrl, userName, onUploadComplete }: AvatarUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true)

            if (!event.target.files || event.target.files.length === 0) {
                return
            }

            const file = event.target.files[0]

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("La imagen debe ser menor a 2MB")
                return
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
                toast.error("Solo se permiten archivos de imagen")
                return
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${userId}/avatar.${fileExt}`

            // Delete old avatar if exists
            if (avatarUrl) {
                const oldPath = avatarUrl.split('/').pop()
                if (oldPath) {
                    await supabase.storage
                        .from('avatars')
                        .remove([`${userId}/${oldPath}`])
                }
            }

            // Upload new avatar
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, file, { upsert: true })

            if (uploadError) {
                throw uploadError
            }

            // Get public URL
            const { data } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName)

            const publicUrl = data.publicUrl

            // Update profile with new avatar URL
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', userId)

            if (updateError) {
                throw updateError
            }

            setAvatarUrl(publicUrl)
            onUploadComplete?.(publicUrl)
            toast.success("Foto de perfil actualizada")
        } catch (error) {
            console.error('Error uploading avatar:', error)
            toast.error("Error al subir la imagen")
        } finally {
            setUploading(false)
        }
    }

    const removeAvatar = async () => {
        try {
            setUploading(true)

            if (avatarUrl) {
                const fileName = avatarUrl.split('/').pop()
                if (fileName) {
                    await supabase.storage
                        .from('avatars')
                        .remove([`${userId}/${fileName}`])
                }
            }

            // Update profile to remove avatar URL
            const { error } = await supabase
                .from('profiles')
                .update({ avatar_url: null })
                .eq('id', userId)

            if (error) throw error

            setAvatarUrl(null)
            onUploadComplete?.('')
            toast.success("Foto de perfil eliminada")
        } catch (error) {
            console.error('Error removing avatar:', error)
            toast.error("Error al eliminar la imagen")
        } finally {
            setUploading(false)
        }
    }

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative group">
                <Avatar className="h-32 w-32 border-4 border-white dark:border-slate-800 shadow-lg">
                    <AvatarImage src={avatarUrl || undefined} alt={userName} />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-primary/60 text-white">
                        {getInitials(userName)}
                    </AvatarFallback>
                </Avatar>

                {/* Upload overlay */}
                <label
                    htmlFor="avatar-upload"
                    className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                >
                    {uploading ? (
                        <Loader2 className="h-8 w-8 text-white animate-spin" />
                    ) : (
                        <Camera className="h-8 w-8 text-white" />
                    )}
                </label>

                <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    className="hidden"
                />
            </div>

            <div className="flex gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                    disabled={uploading}
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Subir Foto
                </Button>

                {avatarUrl && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeAvatar}
                        disabled={uploading}
                    >
                        <X className="h-4 w-4 mr-2" />
                        Eliminar
                    </Button>
                )}
            </div>

            <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                Formatos: JPG, PNG, GIF. Tamaño máximo: 2MB
            </p>
        </div>
    )
}
