import React, { useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext";
import "./GamePage.scss";

const GamePage: React.FC = () => {
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const gameInstanceRef = useRef<any>(null);
    const gameInitializedRef = useRef<boolean>(false); // Prevent double initialization
    const { user, isAuthenticated } = useAuth();

    // Development mode warning
    if (process.env.NODE_ENV === 'development') {
        console.log("🎮 GamePage: Running in development mode - React StrictMode may cause double mounting");
    }

    useEffect(() => {
        // Check if user is authenticated
        if (!isAuthenticated || !user) {
            console.error("User not authenticated");
            return;
        }

        // Allow first initialization, prevent subsequent ones
        if (gameInitializedRef.current) {
            console.log("Game already initialized, skipping... (React StrictMode protection)");
            return;
        }

        console.log("Development mode detected - applying React StrictMode fixes");

        // NUCLEAR CLEANUP: Destroy ALL existing games to ensure clean slate
        console.log("NUCLEAR CLEANUP: Destroying all existing games");
        
        // Destroy local game instance
        if (gameInstanceRef.current) {
            console.log("Destroying existing game instance");
            try {
                gameInstanceRef.current.destroy(true);
            } catch (error) {
                console.warn("Error destroying game instance:", error);
            }
            gameInstanceRef.current = null;
        }

        // Destroy global game
        if ((window as any).game) {
            console.log("Destroying existing global game");
            try {
                (window as any).game.destroy(true);
            } catch (error) {
                console.warn("Error destroying global game:", error);
            }
            (window as any).game = null;
        }

        // Destroy any other Phaser games that might exist
        const allCanvases = document.querySelectorAll('canvas');
        allCanvases.forEach((canvas, index) => {
            console.log(`Removing canvas ${index} from ${canvas.parentElement?.tagName}`);
            canvas.remove();
        });

        // Clear the container completely and remove ALL canvases from DOM
        if (gameContainerRef.current) {
            try {
                gameContainerRef.current.innerHTML = '';
                // Remove any remaining canvas elements
                const canvases = gameContainerRef.current.querySelectorAll('canvas');
                canvases.forEach(canvas => canvas.remove());
            } catch (error) {
                console.warn("Error clearing container:", error);
            }
        }

        // Also remove any canvases that might be attached to body (safety measure)
        const bodyCanvases = document.querySelectorAll('canvas');
        bodyCanvases.forEach(canvas => {
            if (canvas.parentElement === document.body) {
                console.log("Removing orphaned canvas from body");
                canvas.remove();
            }
        });

        // Clear global game reference (already done above)

        // Wait longer to ensure first game instance is established before StrictMode second render
        // In development mode, React StrictMode causes double mounting
        const delay = process.env.NODE_ENV === 'development' ? 500 : 300;
        setTimeout(() => {
            if (gameContainerRef.current && !gameInitializedRef.current) {
                console.log("Creating FIRST game instance (WASD controls) - Development mode delay applied");
                loadPhaserGame(user);
                gameInitializedRef.current = true; // Mark as initialized
                
                // Additional delay to ensure first game is fully established
                setTimeout(() => {
                    console.log("First game instance should now be active with WASD controls");
                }, 200);
            }
        }, delay);

        // Cleanup function
        return () => {
            if (gameInstanceRef.current) {
                console.log("Cleaning up game instance on unmount");
                try {
                    gameInstanceRef.current.destroy(true);
                } catch (error) {
                    console.warn("Error destroying game instance on unmount:", error);
                }
                gameInstanceRef.current = null;
            }
            
            // Clear global game reference
            if ((window as any).game) {
                try {
                    (window as any).game.destroy(true);
                } catch (error) {
                    console.warn("Error destroying global game on unmount:", error);
                }
                (window as any).game = null;
            }

            // Reset initialization flag
            gameInitializedRef.current = false;
        };
    }, [user, isAuthenticated]);

    // Global error handler for WebGL errors
    useEffect(() => {
        const handleWebGLError = (event: ErrorEvent) => {
            if (event.message.includes('Framebuffer') || event.message.includes('WebGL')) {
                console.error('WebGL Error:', event.message);
                // Show user-friendly error message
                if (gameContainerRef.current) {
                    gameContainerRef.current.innerHTML = `
                        <div style="
                            display: flex; 
                            flex-direction: column; 
                            justify-content: center; 
                            align-items: center; 
                            height: 100%; 
                            color: white; 
                            text-align: center;
                            padding: 20px;
                        ">
                            <h3>Graphics Error</h3>
                            <p>There was a graphics rendering error. Please try refreshing the page or using a different browser.</p>
                            <button onclick="window.location.reload()" style="
                                margin-top: 20px; 
                                padding: 10px 20px; 
                                background: #667eea; 
                                color: white; 
                                border: none; 
                                border-radius: 5px; 
                                cursor: pointer;
                            ">
                                Refresh Page
                            </button>
                        </div>
                    `;
                }
            }
        };

        window.addEventListener('error', handleWebGLError);

        return () => {
            window.removeEventListener('error', handleWebGLError);
        };
    }, []);

            const loadPhaserGame = async (user: any) => {
                try {
                    // Ensure container is ready
                    if (!gameContainerRef.current) {
                        console.error('Game container is not ready');
                        return;
                    }

                    // Prevent creating multiple games
                    if (gameInstanceRef.current || (window as any).game) {
                        console.warn('Game already exists, skipping creation');
                        return;
                    }

                    console.log('Creating FIRST game instance with WASD controls (no Shift required)');
                    
                    // Double-check that container is completely clean
                    if (gameContainerRef.current) {
                        gameContainerRef.current.innerHTML = '';
                        const canvases = gameContainerRef.current.querySelectorAll('canvas');
                        canvases.forEach(canvas => canvas.remove());
                    }
                    
                    // Simple wait for container to be ready
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Import integrated game
                    const { createPhaserGame } = await import('../../game/integrated-game');

                    // Create the game instance with user data
                    const userData = {
                        userId: user.userid || user.id,
                        username: user.username,
                        token: localStorage.getItem('token')
                    };
                    
                    console.log('Creating new game instance with user data:', {
                        userId: userData.userId,
                        username: userData.username,
                        token: userData.token ? userData.token.substring(0, 20) + '...' : 'No token'
                    });
                    
                    // Create the game instance
                    gameInstanceRef.current = createPhaserGame(gameContainerRef.current, userData);

                    // Make game instance globally accessible for debugging
                    (window as any).gameInstance = gameInstanceRef.current;

                    // Ensure the game canvas gets focus immediately
                    setTimeout(() => {
                        if (gameInstanceRef.current && gameInstanceRef.current.canvas) {
                            gameInstanceRef.current.canvas.focus();
                            gameInstanceRef.current.canvas.setAttribute('tabindex', '0');
                        }
                    }, 100);

                } catch (error) {
                    console.error('Failed to load Phaser game:', error);
                    
                    // Clean up any partial game instance
                    if (gameInstanceRef.current) {
                        try {
                            gameInstanceRef.current.destroy(true);
                        } catch (destroyError) {
                            console.warn('Error destroying failed game instance:', destroyError);
                        }
                        gameInstanceRef.current = null;
                    }
                    
                    // Show user-friendly error message
                    if (gameContainerRef.current) {
                        gameContainerRef.current.innerHTML = `
                            <div style="
                                display: flex; 
                                flex-direction: column; 
                                justify-content: center; 
                                align-items: center; 
                                height: 100%; 
                                color: white; 
                                text-align: center;
                                padding: 20px;
                            ">
                                <h3>Game Loading Error</h3>
                                <p>There was an issue loading the game. This might be due to:</p>
                                <ul style="text-align: left; margin: 10px 0;">
                                    <li>Outdated graphics drivers</li>
                                    <li>Browser compatibility issues</li>
                                    <li>Graphics rendering problems</li>
                                </ul>
                                <p>Please try:</p>
                                <ul style="text-align: left; margin: 10px 0;">
                                    <li>Updating your browser</li>
                                    <li>Updating graphics drivers</li>
                                    <li>Enabling hardware acceleration</li>
                                    <li>Using a different browser</li>
                                </ul>
                                <button onclick="window.location.reload()" style="
                                    margin-top: 20px; 
                                    padding: 10px 20px; 
                                    background: #667eea; 
                                    color: white; 
                                    border: none; 
                                    border-radius: 5px; 
                                    cursor: pointer;
                                ">
                                    Retry
                                </button>
                            </div>
                        `;
                    }
                }
            };

    // Show loading state if user is not authenticated
    if (!isAuthenticated || !user) {
        return (
            <div className="game-page">
                <div className="game-container">
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: '100%',
                        color: 'white',
                        fontSize: '18px'
                    }}>
                        Please log in to play the assessment game.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="game-page">
            <div className="game-container">
                <div 
                    ref={gameContainerRef} 
                    id="game" 
                    className="phaser-game-container"
                />
            </div>
        </div>
    );
};

export default GamePage;
