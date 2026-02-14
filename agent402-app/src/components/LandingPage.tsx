import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface CursorTrail {
  id: number;
  x: number;
  y: number;
}

const LandingPage: React.FC = () => {
  const [cursorTrails, setCursorTrails] = useState<CursorTrail[]>([]);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const trailIdRef = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMobile) { // Only show cursor trails on desktop
        setCursorPosition({ x: e.clientX, y: e.clientY });
        
        // Add new trail
        const newTrail: CursorTrail = {
          id: trailIdRef.current++,
          x: e.clientX,
          y: e.clientY,
        };
        
        setCursorTrails((prevTrails) => [...prevTrails, newTrail]);
        
        // Remove trail after animation completes
        setTimeout(() => {
          setCursorTrails((prevTrails) => 
            prevTrails.filter((trail) => trail.id !== newTrail.id)
          );
        }, 800);
      }
    };

    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    document.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [isMobile]);

  const handleClick = () => {
    navigate('/dashboard');
  };

  return (
    <div className="app landing-page" onClick={handleClick}>
      <div className="animated-background">
        <div className="grid-overlay"></div>
      </div>
      <div className="content">
        <h1 className="title">Agent 402</h1>
        <p className="subtitle">Agentic Commerce USDC to Fiat</p>
      </div>
      
      <div 
        className="custom-cursor" 
        style={{ left: `${cursorPosition.x}px`, top: `${cursorPosition.y}px` }}
      />
      
      {cursorTrails.map((trail) => (
        <div
          key={trail.id}
          className="cursor-trail"
          style={{ left: `${trail.x}px`, top: `${trail.y}px` }}
        />
      ))}
    </div>
  );
};

export default LandingPage;