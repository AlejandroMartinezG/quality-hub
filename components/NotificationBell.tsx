'use client'

import { Bell, X, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export interface Notification {
    id: string
    user_id: string
    type: string
    title: string
    message: string
    link?: string
    metadata?: any
    read: boolean
    created_at: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [open, setOpen] = useState(false)
    const router = useRouter()

    useEffect(() => {
        loadNotifications()
        const interval = setInterval(loadNotifications, 30_000)
        return () => clearInterval(interval)
    }, [])

    async function loadNotifications() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .not('type', 'in', '(NCR_CREATED,NCR_STATUS_CHANGE,DISPOSICION_REGISTRADA)')
            .order('created_at', { ascending: false })
            .limit(20)

        if (data) {
            setNotifications(data)
            setUnreadCount(data.filter(n => !n.read).length)
        }
    }

    async function markAsRead(id: string) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
        await supabase.from('notifications').update({ read: true }).eq('id', id)
    }

    async function markAllRead() {
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id)
        if (unreadIds.length === 0) return
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
        await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    }

    async function deleteNotification(e: React.MouseEvent, id: string) {
        e.stopPropagation()
        setNotifications(prev => {
            const updated = prev.filter(n => n.id !== id)
            setUnreadCount(updated.filter(n => !n.read).length)
            return updated
        })
        await supabase.from('notifications').delete().eq('id', id)
    }

    async function deleteAll() {
        const ids = notifications.map(n => n.id)
        if (ids.length === 0) return
        setNotifications([])
        setUnreadCount(0)
        await supabase.from('notifications').delete().in('id', ids)
    }

    const handleNotificationClick = (notif: Notification) => {
        setOpen(false)
        if (!notif.read) markAsRead(notif.id)
        const isMessageType = notif.type === 'CHAT_CALIDAD' || notif.type === 'COMENTARIO_NUEVO'
        if (isMessageType) {
            const mid = notif.metadata?.measurement_id
            router.push(mid ? `/calidad?chat=${mid}` : '/calidad')
            return
        }
        if (notif.link) router.push(notif.link)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-blue-900 dark:text-slate-400 dark:hover:text-blue-400">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-80 p-0" align="end">
                <div className="px-4 pt-2.5 pb-2 border-b">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">Notificaciones</h3>
                        {unreadCount > 0 && (
                            <span className="text-[10px] font-medium text-slate-400">{unreadCount} sin leer</span>
                        )}
                    </div>
                    {(unreadCount > 0 || notifications.length > 0) && (
                        <div className="flex items-center gap-1 mt-1.5">
                            {unreadCount > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-6 px-2 py-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                    onClick={markAllRead}
                                >
                                    Marcar todo leído
                                </Button>
                            )}
                            {notifications.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-6 px-2 py-0 text-red-500 hover:text-red-700 hover:bg-red-50 ml-auto"
                                    onClick={deleteAll}
                                >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Borrar todo
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                <div className="max-h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                            <Bell className="mx-auto h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No tienes notificaciones</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map(notif => (
                                <div
                                    key={notif.id}
                                    className={`px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex gap-3 group ${!notif.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                                    onClick={() => handleNotificationClick(notif)}
                                >
                                    <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!notif.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <p className={`text-sm leading-none truncate ${!notif.read ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-400'}`}>
                                                {notif.title}
                                            </p>
                                            <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                                {new Date(notif.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notif.message}
                                        </p>
                                    </div>
                                    <button
                                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 text-slate-400 hover:text-red-500"
                                        onClick={(e) => deleteNotification(e, notif.id)}
                                        title="Eliminar"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
