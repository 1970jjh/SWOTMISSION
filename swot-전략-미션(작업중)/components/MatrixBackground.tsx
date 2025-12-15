
import React, { useEffect, useRef } from 'react';

interface MatrixBackgroundProps {
    isDarkMode: boolean;
}

const MatrixBackground: React.FC<MatrixBackgroundProps> = ({ isDarkMode }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let width = window.innerWidth;
        let height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;

        const columns = Math.floor(width / 20);
        const drops: number[] = [];

        for (let i = 0; i < columns; i++) {
            drops[i] = 1;
        }

        const chars = "0123456789ABCDEFSWOTGAME";

        const draw = () => {
            // Fade effect
            ctx.fillStyle = isDarkMode ? 'rgba(2, 6, 23, 0.1)' : 'rgba(248, 250, 252, 0.1)'; 
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = isDarkMode ? '#0f0' : '#059669'; // Bright green (Dark) vs Emerald 600 (Light)
            ctx.font = '15px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = chars.charAt(Math.floor(Math.random() * chars.length));
                ctx.fillText(text, i * 20, drops[i] * 20);

                if (drops[i] * 20 > height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };

        const interval = setInterval(draw, 40);

        const handleResize = () => {
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = width;
            canvas.height = height;
        };

        window.addEventListener('resize', handleResize);

        return () => {
            clearInterval(interval);
            window.removeEventListener('resize', handleResize);
        };
    }, [isDarkMode]);

    return (
        <canvas 
            ref={canvasRef} 
            className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-30"
        />
    );
};

export default MatrixBackground;
