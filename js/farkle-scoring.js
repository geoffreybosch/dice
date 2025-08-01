// Complete Farkle Scoring System
// This file contains all official Farkle scoring rules and calculations

/**
 * Calculate score for selected dice and validate that ALL dice contribute
 * @param {Array} selectedDice - Array of selected dice values
 * @returns {Object} - {points: number, description: string, isValid: boolean, scoringDice: Array}
 */
function calculateSelectedDiceScore(selectedDice) {
    const result = calculateFarkleScore(selectedDice);
    
    // For selected dice, we need to ensure ALL selected dice contribute to the score
    // Not just that the total points > 0, but that every die contributes
    const isValid = result.points > 0 && result.scoringDice.length === selectedDice.length;
    
    return {
        points: result.points,
        description: result.description,
        isValid: isValid,
        scoringDice: result.scoringDice
    };
}

/**
 * Calculate points for a set of dice using complete Farkle rules
 * @param {Array} diceValues - Array of dice values (1-6)
 * @returns {Object} - {points: number, description: string, scoringDice: Array}
 */
function calculateFarkleScore(diceValues) {
    if (!Array.isArray(diceValues) || diceValues.length === 0) {
        return { points: 0, description: "No dice", scoringDice: [] };
    }

    // Count frequency of each die value
    const counts = [0, 0, 0, 0, 0, 0, 0]; // Index 0 unused, 1-6 for die values
    diceValues.forEach(value => {
        if (value >= 1 && value <= 6) {
            counts[value]++;
        }
    });

    let totalPoints = 0;
    let descriptions = [];
    let usedDice = new Array(diceValues.length).fill(false);

    // Check for special combinations first (highest priority)
    
    // 1. Six of a kind (any number) = 3000 points
    for (let value = 1; value <= 6; value++) {
        if (counts[value] === 6) {
            totalPoints += 3000;
            descriptions.push(`Six ${value}s (3000)`);
            markDiceAsUsed(diceValues, usedDice, value, 6);
            return { points: totalPoints, description: descriptions.join(' + '), scoringDice: getAllIndices(usedDice) };
        }
    }

    // 2. Straight (1,2,3,4,5,6) = 1500 points
    if (counts[1] >= 1 && counts[2] >= 1 && counts[3] >= 1 && 
        counts[4] >= 1 && counts[5] >= 1 && counts[6] >= 1) {
        totalPoints += 1500;
        descriptions.push("Straight 1-6 (1500)");
        // Mark one of each die as used
        for (let value = 1; value <= 6; value++) {
            markDiceAsUsed(diceValues, usedDice, value, 1);
        }
        return { points: totalPoints, description: descriptions.join(' + '), scoringDice: getAllIndices(usedDice) };
    }

    // 3. Three pairs = 1500 points
    let pairCount = 0;
    let pairValues = [];
    for (let value = 1; value <= 6; value++) {
        if (counts[value] === 2) {
            pairCount++;
            pairValues.push(value);
        }
    }
    if (pairCount === 3) {
        totalPoints += 1500;
        descriptions.push("Three pairs (1500)");
        pairValues.forEach(value => {
            markDiceAsUsed(diceValues, usedDice, value, 2);
        });
        return { points: totalPoints, description: descriptions.join(' + '), scoringDice: getAllIndices(usedDice) };
    }

    // 4. Four of a kind + pair = 1500 points
    let fourOfAKindValue = 0;
    let pairValue = 0;
    for (let value = 1; value <= 6; value++) {
        if (counts[value] === 4) fourOfAKindValue = value;
        if (counts[value] === 2) pairValue = value;
    }
    if (fourOfAKindValue > 0 && pairValue > 0) {
        totalPoints += 1500;
        descriptions.push(`Four ${fourOfAKindValue}s + pair of ${pairValue}s (1500)`);
        markDiceAsUsed(diceValues, usedDice, fourOfAKindValue, 4);
        markDiceAsUsed(diceValues, usedDice, pairValue, 2);
        return { points: totalPoints, description: descriptions.join(' + '), scoringDice: getAllIndices(usedDice) };
    }

    // 5. Two triplets = 2500 points
    let tripletValues = [];
    for (let value = 1; value <= 6; value++) {
        if (counts[value] === 3) {
            tripletValues.push(value);
        }
    }
    if (tripletValues.length === 2) {
        totalPoints += 2500;
        descriptions.push(`Two triplets: ${tripletValues[0]}s and ${tripletValues[1]}s (2500)`);
        tripletValues.forEach(value => {
            markDiceAsUsed(diceValues, usedDice, value, 3);
        });
        return { points: totalPoints, description: descriptions.join(' + '), scoringDice: getAllIndices(usedDice) };
    }

    // 6. Five of a kind = 2000 points
    for (let value = 1; value <= 6; value++) {
        if (counts[value] === 5) {
            totalPoints += 2000;
            descriptions.push(`Five ${value}s (2000)`);
            markDiceAsUsed(diceValues, usedDice, value, 5);
            // Continue to check remaining die for individual scoring
            break;
        }
    }

    // 7. Four of a kind = 1000 points
    for (let value = 1; value <= 6; value++) {
        if (counts[value] === 4 && !isValueUsed(usedDice, diceValues, value, 4)) {
            totalPoints += 1000;
            descriptions.push(`Four ${value}s (1000)`);
            markDiceAsUsed(diceValues, usedDice, value, 4);
            break;
        }
    }

    // 8. Three of a kind
    for (let value = 1; value <= 6; value++) {
        if (counts[value] >= 3 && !isValueUsed(usedDice, diceValues, value, 3)) {
            let points;
            if (value === 1) {
                // Get the current three 1s rule setting (300 or 1000)
                points = typeof getThreeOnesValue === 'function' ? getThreeOnesValue() : 1000;
            } else {
                points = value * 100; // Three of anything else = face value × 100
            }
            totalPoints += points;
            descriptions.push(`Three ${value}s (${points})`);
            markDiceAsUsed(diceValues, usedDice, value, 3);
            break;
        }
    }

    // 9. Individual 1s and 5s (only if not already used in combinations)
    // Individual 1s = 100 points each
    let remainingOnes = counts[1];
    for (let i = 0; i < diceValues.length && remainingOnes > 0; i++) {
        if (diceValues[i] === 1 && !usedDice[i]) {
            totalPoints += 100;
            descriptions.push("1 (100)");
            usedDice[i] = true;
            remainingOnes--;
        }
    }

    // Individual 5s = 50 points each
    let remainingFives = counts[5];
    for (let i = 0; i < diceValues.length && remainingFives > 0; i++) {
        if (diceValues[i] === 5 && !usedDice[i]) {
            totalPoints += 50;
            descriptions.push("5 (50)");
            usedDice[i] = true;
            remainingFives--;
        }
    }

    return {
        points: totalPoints,
        description: descriptions.length > 0 ? descriptions.join(' + ') : "No scoring dice",
        scoringDice: getAllIndices(usedDice)
    };
}



/**
 * Check if a roll is a Farkle (no scoring dice)
 * @param {Array} diceValues - Array of dice values
 * @returns {boolean} - True if it's a Farkle
 */
function isFarkle(diceValues) {
    const result = calculateFarkleScore(diceValues);
    return result.points === 0;
}

// Helper functions
function markDiceAsUsed(diceValues, usedDice, value, count) {
    let marked = 0;
    for (let i = 0; i < diceValues.length && marked < count; i++) {
        if (diceValues[i] === value && !usedDice[i]) {
            usedDice[i] = true;
            marked++;
        }
    }
}

function isValueUsed(usedDice, diceValues, value, count) {
    let usedCount = 0;
    for (let i = 0; i < diceValues.length; i++) {
        if (diceValues[i] === value && usedDice[i]) {
            usedCount++;
        }
    }
    return usedCount >= count;
}

function getAllIndices(usedDice) {
    const indices = [];
    for (let i = 0; i < usedDice.length; i++) {
        if (usedDice[i]) {
            indices.push(i);
        }
    }
    return indices;
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateFarkleScore,
        calculateSelectedDiceScore,
        isFarkle
    };
}
