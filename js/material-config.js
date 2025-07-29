// Material Physics Configuration
// This file contains physics properties for different dice and floor materials
// Adjust these values to customize the behavior of each material type
// Don't add anything to this file that is not related to material physics

// Helper function to convert RGB to hex
function rgbToHex(r, g, b) {
    return (r << 16) | (g << 8) | b;
}

// Helper function to convert RGBA object to hex
function rgbaToHex(rgba) {
    return rgbToHex(rgba.r, rgba.g, rgba.b);
}

const MaterialConfig = {
    // Dice Material Properties
    diceMaterials: {
        default: {
            name: "Default",
            restitution: 0.6,     // Bounciness (0 = no bounce, 1 = perfect bounce)
            friction: 0.3,        // Surface friction (0 = ice-like, 1 = very grippy)
            linearDamping: 0.1,   // How quickly linear motion slows down
            angularDamping: 0.1,  // How quickly spinning slows down
            density: 1.0,         // Mass density (affects how heavy dice feel)
            colorRgb: { r: 255, g: 255, b: 255 },  // RGB color values
            get color() { return rgbaToHex(this.colorRgb); },  // Auto-convert to hex
            shininess: 30,        // Material shininess for reflections
            transparent: false,
            opacity: 1.0
        },
        wood: {
            name: "Wood",
            restitution: 0.4,     // Wood bounces less than default
            friction: 0.5,        // Higher friction, more realistic wood feel
            linearDamping: 0.15,
            angularDamping: 0.15,
            density: 0.8,         // Lighter than default
            colorRgb: { r: 139, g: 69, b: 19 },
            get color() { return rgbaToHex(this.colorRgb); },
            shininess: 20,
            transparent: false,
            opacity: 1.0
        },
        metal: {
            name: "Metal",
            restitution: 0.8,     // Very bouncy like metal
            friction: 0.2,        // Low friction, slippery
            linearDamping: 0.05,  // Slides more
            angularDamping: 0.05,
            density: 2.0,         // Heavy like real metal
            colorRgb: { r: 192, g: 192, b: 192 },
            get color() { return rgbaToHex(this.colorRgb); },
            shininess: 100,       // Very shiny
            transparent: false,
            opacity: 1.0
        },
        marble: {
            name: "Marble",
            restitution: 0.7,     // Good bounce like polished stone
            friction: 0.25,       // Smooth surface
            linearDamping: 0.08,
            angularDamping: 0.08,
            density: 1.5,         // Heavy like real marble
            colorRgb: { r: 248, g: 248, b: 255 },
            get color() { return rgbaToHex(this.colorRgb); },
            shininess: 80,
            transparent: false,
            opacity: 1.0
        },
        plastic: {
            name: "Plastic",
            restitution: 0.65,    // Moderately bouncy
            friction: 0.4,        // Moderate friction
            linearDamping: 0.12,
            angularDamping: 0.12,
            density: 0.6,         // Light like plastic
            colorRgb: { r: 255, g: 255, b: 170 },
            get color() { return rgbaToHex(this.colorRgb); },
            shininess: 50,
            transparent: false,
            opacity: 1.0
        },
        glass: {
            name: "Glass",
            restitution: 0.3,     // Fragile, doesn't bounce much
            friction: 0.15,       // Very smooth
            linearDamping: 0.05,
            angularDamping: 0.05,
            density: 1.2,         // Moderate weight
            colorRgb: { r: 135, g: 206, b: 235 },
            get color() { return rgbaToHex(this.colorRgb); },
            shininess: 90,
            transparent: true,
            opacity: 0.8
        }
    },

    // Floor Material Properties
    floorMaterials: {
        grass: {
            name: "Grass",
            restitution: 0.3,     // Soft, absorbs impact
            friction: 0.7,        // High friction, dice stop quickly
            colorRgb: { r: 34, g: 139, b: 34 },
            get color() { return rgbaToHex(this.colorRgb); },
            wallColorRgb: { r: 139, g: 69, b: 19 },  // Brown wood walls for outdoor feel
            get wallColor() { return rgbaToHex(this.wallColorRgb); },
            roughness: 0.8        // Visual roughness
        },
        wood: {
            name: "Wood",
            restitution: 0.5,     // Moderate bounce
            friction: 0.4,        // Smooth but not slippery
            colorRgb: { r: 139, g: 69, b: 19 },
            get color() { return rgbaToHex(this.colorRgb); },
            wallColorRgb: { r: 160, g: 82, b: 45 },  // Slightly darker sienna brown
            get wallColor() { return rgbaToHex(this.wallColorRgb); },
            roughness: 0.6
        },
        stone: {
            name: "Stone",
            restitution: 0.7,     // Hard surface, good bounce
            friction: 0.5,        // Moderate friction
            colorRgb: { r: 105, g: 105, b: 105 },
            get color() { return rgbaToHex(this.colorRgb); },
            wallColorRgb: { r: 47, g: 79, b: 79 },  // Dark slate gray
            get wallColor() { return rgbaToHex(this.wallColorRgb); },
            roughness: 0.9
        },
        carpet: {
            name: "Carpet",
            restitution: 0.2,     // Very soft, minimal bounce
            friction: 0.9,        // Very high friction
            colorRgb: { r: 139, g: 0, b: 0 },
            get color() { return rgbaToHex(this.colorRgb); },
            wallColorRgb: { r: 101, g: 67, b: 33 },  // Dark brown wood trim
            get wallColor() { return rgbaToHex(this.wallColorRgb); },
            roughness: 1.0
        },
        marble: {
            name: "Marble",
            restitution: 0.8,     // Very bouncy, hard surface
            friction: 0.2,        // Smooth, low friction
            colorRgb: { r: 248, g: 248, b: 255 },
            get color() { return rgbaToHex(this.colorRgb); },
            wallColorRgb: { r: 220, g: 220, b: 220 },  // Light gray marble walls
            get wallColor() { return rgbaToHex(this.wallColorRgb); },
            roughness: 0.1
        },
        felt: {
            name: "Felt",
            restitution: 0.15,    // Gaming table felt, very soft
            friction: 0.8,        // High friction like casino tables
            colorRgb: { r: 0, g: 100, b: 0 },
            get color() { return rgbaToHex(this.colorRgb); },
            wallColorRgb: { r: 128, g: 0, b: 32 },  // Classic casino wood trim
            get wallColor() { return rgbaToHex(this.wallColorRgb); },
            roughness: 0.7
        }
    },

    // Wall Material Properties (affects dice-wall interactions)
    wallMaterial: {
        restitution: 0.6,
        friction: 0.3
    },

    // Preset Combinations for Different Gaming Experiences
    presets: {
        casino: {
            name: "Casino Style",
            dice: "plastic",
            floor: "felt",
            description: "Classic casino experience with plastic dice on felt"
        },
        luxury: {
            name: "Luxury",
            dice: "marble",
            floor: "marble",
            description: "High-end marble dice on marble surface"
        },
        classic: {
            name: "Classic Wood",
            dice: "wood",
            floor: "wood",
            description: "Traditional wooden dice on wooden table"
        },
        modern: {
            name: "Modern Steel",
            dice: "metal",
            floor: "stone",
            description: "Contemporary metal dice on stone surface"
        },
        garden: {
            name: "Garden Party",
            dice: "wood",
            floor: "grass",
            description: "Outdoor gaming with wooden dice on grass"
        },
        elegant: {
            name: "Elegant Glass",
            dice: "glass",
            floor: "marble",
            description: "Sophisticated glass dice on marble"
        }
    },

    // Background Material Properties
    backgroundMaterials: {
        white: {
            name: "White",
            color: 0xffffff,
            colorRgb: { r: 255, g: 255, b: 255 }
        },
        grey: {
            name: "Grey",
            color: 0x808080,
            colorRgb: { r: 128, g: 128, b: 128 }
        },
        black: {
            name: "Black",
            color: 0x000000,
            colorRgb: { r: 0, g: 0, b: 0 }
        },
        lightblue: {
            name: "Light Blue",
            color: 0x87ceeb,
            colorRgb: { r: 135, g: 206, b: 235 }
        },
        cream: {
            name: "Cream",
            color: 0xfffff0,
            colorRgb: { r: 255, g: 255, b: 240 }
        },
        darkblue: {
            name: "Dark Blue",
            color: 0x1e3a8a,
            colorRgb: { r: 30, g: 58, b: 138 }
        }
    }
};

// Helper function to get dice material properties
function getDiceMaterialProperties(materialType) {
    return MaterialConfig.diceMaterials[materialType] || MaterialConfig.diceMaterials.default;
}

// Helper function to get floor material properties
function getFloorMaterialProperties(materialType) {
    return MaterialConfig.floorMaterials[materialType] || MaterialConfig.floorMaterials.grass;
}

// Helper function to get background material properties
function getBackgroundMaterialProperties(materialType) {
    return MaterialConfig.backgroundMaterials[materialType] || MaterialConfig.backgroundMaterials.white;
}

// Helper function to apply preset
function applyMaterialPreset(presetName) {
    const preset = MaterialConfig.presets[presetName];
    if (preset) {
        return {
            dice: preset.dice,
            floor: preset.floor,
            name: preset.name,
            description: preset.description
        };
    }
    return null;
}

// Material Preference Storage Functions
function saveMaterialPreferences(diceType, floorType, backgroundType = 'white') {
    const preferences = {
        dice: diceType,
        floor: floorType,
        background: backgroundType,
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('farkle_material_preferences', JSON.stringify(preferences));
        console.log(`Material preferences saved: Dice=${diceType}, Floor=${floorType}, Background=${backgroundType}`);
        return true;
    } catch (error) {
        console.warn('Failed to save material preferences:', error);
        return false;
    }
}

function loadMaterialPreferences() {
    try {
        const saved = localStorage.getItem('farkle_material_preferences');
        if (saved) {
            const preferences = JSON.parse(saved);
            
            // Validate that the saved materials still exist in the config
            const diceExists = MaterialConfig.diceMaterials[preferences.dice];
            const floorExists = MaterialConfig.floorMaterials[preferences.floor];
            const backgroundExists = MaterialConfig.backgroundMaterials[preferences.background || 'white'];
            
            if (diceExists && floorExists && backgroundExists) {
                console.log(`Material preferences loaded: Dice=${preferences.dice}, Floor=${preferences.floor}, Background=${preferences.background || 'white'}`);
                return {
                    dice: preferences.dice,
                    floor: preferences.floor,
                    background: preferences.background || 'white',
                    timestamp: preferences.timestamp
                };
            } else {
                console.warn('Saved material preferences contain invalid materials, using defaults');
                clearMaterialPreferences();
            }
        }
    } catch (error) {
        console.warn('Failed to load material preferences:', error);
    }
    
    // Return defaults if no valid saved preferences
    return {
        dice: 'default',
        floor: 'grass',
        background: 'white',
        timestamp: null
    };
}

function clearMaterialPreferences() {
    try {
        localStorage.removeItem('farkle_material_preferences');
        console.log('Material preferences cleared');
        return true;
    } catch (error) {
        console.warn('Failed to clear material preferences:', error);
        return false;
    }
}

function hasSavedPreferences() {
    try {
        const saved = localStorage.getItem('farkle_material_preferences');
        return saved !== null;
    } catch (error) {
        return false;
    }
}

// Helper function to get preference age in days
function getPreferenceAge() {
    const preferences = loadMaterialPreferences();
    if (preferences.timestamp) {
        const ageInMs = Date.now() - preferences.timestamp;
        return Math.floor(ageInMs / (1000 * 60 * 60 * 24)); // Convert to days
    }
    return null;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MaterialConfig,
        getDiceMaterialProperties,
        getFloorMaterialProperties,
        getBackgroundMaterialProperties,
        applyMaterialPreset,
        saveMaterialPreferences,
        loadMaterialPreferences,
        clearMaterialPreferences,
        hasSavedPreferences,
        getPreferenceAge
    };
}
