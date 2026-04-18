/**
 * Utility functions for generating user avatars
 */

/**
 * Generate a unique avatar URL using ui-avatars.com service
 * @param username - The username to generate avatar for
 * @param size - Size of the avatar in pixels (default: 40)
 * @returns Avatar URL string
 */
export const generateAvatarUrl = (username: string, size: number = 40): string => {
    if (!username) return '';
    
    // Use deterministic color based on username hash
    const hash = username.split('').reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    
    const colors = [
        '2563eb', // Indigo
        '7c3aed', // Violet
        'dc2626', // Red
        'f97316', // Orange
        '0891b2', // Cyan
        '059669', // Emerald
        '7c2d12', // Amber
    ];
    
    const colorIndex = Math.abs(hash) % colors.length;
    const backgroundColor = colors[colorIndex];
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=${backgroundColor}&color=ffffff&size=${size}&bold=true&font-size=0.4`;
};

/**
 * Get avatar URL from user object or generate one
 * @param username - Username to generate avatar for
 * @param existingAvatarUrl - Optional existing avatar URL
 * @returns Avatar URL string
 */
export const getAvatarUrl = (username: string, existingAvatarUrl?: string, size: number = 40): string => {
    if (existingAvatarUrl) {
        return existingAvatarUrl;
    }
    return generateAvatarUrl(username, size);
};
