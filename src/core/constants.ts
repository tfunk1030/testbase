// Physical Constants
export const GRAVITY = 9.81;                  // m/s²
export const AIR_GAS_CONSTANT = 287.05;       // J/(kg·K)
export const STANDARD_AIR_DENSITY = 1.225;    // kg/m³
export const STANDARD_TEMPERATURE = 288.15;    // K (15°C)
export const STANDARD_PRESSURE = 101325;       // Pa

// Ball Properties
export const STANDARD_BALL_MASS = 0.0459;     // kg
export const STANDARD_BALL_DIAMETER = 0.0427;  // m
export const STANDARD_BALL_AREA = Math.PI * Math.pow(STANDARD_BALL_DIAMETER / 2, 2);

// Aerodynamic Coefficients from Wind Tunnel Data
export const DRAG_COEFFICIENTS = {
    // Reynolds Number -> Cd
    100000: 0.225,
    120000: 0.220,
    140000: 0.215,
    160000: 0.210,
    180000: 0.205
};

export const LIFT_COEFFICIENTS = {
    // Spin Rate (rpm) -> Cl
    2000: 0.21,
    2500: 0.23,
    3000: 0.25,
    3500: 0.27,
    4000: 0.29
};

// Dimple Pattern Effects
export const DIMPLE_EFFECTS = {
    'icosahedral': { coverage: 0.754, effect: 1.00 },
    'octahedral': { coverage: 0.768, effect: 1.02 },
    'tetrahedral': { coverage: 0.762, effect: 1.01 },
    'hybrid': { coverage: 0.771, effect: 1.03 }
};

// Environmental Effects
export const TEMPERATURE_FACTORS = {
    40: 0.972,  // -2.8%
    50: 0.981,  // -1.9%
    60: 0.990,  // -1.0%
    70: 1.000,  // Baseline
    80: 1.009,  // +0.9%
    90: 1.018   // +1.8%
};

export const ALTITUDE_FACTORS = {
    0: 1.000,
    1000: 1.021,
    2000: 1.042,
    3000: 1.064,
    4000: 1.086
};

// Wind Profile Constants
export const WIND_PROFILE = {
    roughnessLength: 0.03,  // Typical golf course
    referenceHeight: 10,    // meters
    powerLawExponent: 0.143 // Typical for open terrain
};

// Spin Decay Constants
export const SPIN_DECAY = {
    decayRate: 0.08,        // Per second
    axisStability: 0.95     // Retention per second
};

// Validation Thresholds
export const VALIDATION = {
    carryAccuracy: 1.0,     // yards
    directionAccuracy: 0.5, // degrees
    heightAccuracy: 0.5,    // yards
    spinAccuracy: 50,       // rpm
    launchAccuracy: 0.2     // degrees
};
