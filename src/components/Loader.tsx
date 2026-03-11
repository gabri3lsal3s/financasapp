import { Loader2 } from 'lucide-react'

interface LoaderProps {
    size?: number
    className?: string
    text?: string
}

export default function Loader({ size = 24, className = '', text }: LoaderProps) {
    const hasPadding = !className.includes('p-')
    return (
        <div className={`flex flex-col items-center justify-center gap-3 animate-page-fade ${hasPadding ? 'p-8' : ''} ${className}`}>
            <Loader2
                size={size}
                className={`text-primary animate-spin ${className}`}
                style={{ animationDuration: '1.2s' }}
            />
            {text && (
                <div className="flex items-center gap-2 text-secondary text-sm animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                    <span>{text}</span>
                </div>
            )}
        </div>
    )
}
