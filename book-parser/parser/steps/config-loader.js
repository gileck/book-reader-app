const fs = require('fs');

/**
 * Load book configuration from file or return defaults
 * @param {string|null} configPath - Path to config file (optional)
 * @returns {Object} Configuration object with merged defaults
 */
function loadBookConfig(configPath) {
    // If no config path provided, return defaults
    if (!configPath) {
        return getDefaultConfig();
    }

    if (!fs.existsSync(configPath)) {
        return getDefaultConfig();
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Merge with defaults
        return {
            ...getDefaultConfig(),
            ...config,
            metadata: { ...getDefaultConfig().metadata, ...(config.metadata || {}) }
        };
    } catch (error) {
        return getDefaultConfig();
    }
}

/**
 * Get default configuration for book parsing
 * @returns {Object} Default configuration object
 */
function getDefaultConfig() {
    return {
        chapterNames: [],
        chapterPatterns: [
            "^chapter\\s+(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\b",
            "^(\\d+)\\.\\s+([A-Za-z][a-zA-Z\\s]{8,40})$",
            "^(introduction|conclusion|epilogue|prologue|preface|foreword|afterword)$",
            "^[A-Z\\s]{5,30}$"
        ],
        excludePatterns: [
            "^(appendix|bibliography|index|notes|references|acknowledgements|about the author|glossary)$"
        ],
        skipFrontMatter: true,
        chapterNumbering: "sequential",
        metadata: { title: null, author: null }
    };
}

module.exports = {
    loadBookConfig,
    getDefaultConfig
}; 