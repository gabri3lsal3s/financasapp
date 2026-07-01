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
                className={`text-primary animate-spin ${className} animate-loader-slow`}
            />
            {text && (
                <div className="text-secondary text-sm animate-pulse">
                    <span>{text}</span>
                </div>
            )}
        </div>
    )
}
