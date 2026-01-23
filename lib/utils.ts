import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

export function deslugify(slug: string): string {
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function getDriveViewUrl(fileId: string | null | undefined): string | null {
    if (!fileId) return null;
    return `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
}

export function getDriveDownloadUrl(fileId: string | null | undefined): string | null {
    if (!fileId) return null;
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export function getBasePath(): string {
    return process.env.NEXT_PUBLIC_BASE_PATH || '';
}
