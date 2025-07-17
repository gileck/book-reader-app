/**
 * Validation functions for Step 3-1: Link Detection
 */

/**
 * Validate link detection results
 * @param {Object} output - Output from execute function
 * @returns {boolean} - True if validation passes
 */
function validate(output) {
    const links = output.links;
    
    // Links are optional, so if there are none, that's still valid
    if (!links || links.length === 0) {
        return true;
    }
    
    const linksByRole = { source: [], target: [] };
    
    // Group links by role and validate roles
    for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const linkIdentifier = link.linkId || `link_${i + 1}`;
        
        // Check that all links have valid roles
        if (!link.role || (link.role !== 'source' && link.role !== 'target')) {
            console.error(`❌ Link validation failed: Link ${linkIdentifier} must have role "source" or "target". Found: "${link.role}"`);
            return false;
        }
        
        // Check required fields
        if (!link.linkId) {
            console.error(`❌ Link validation failed: Link ${i + 1} missing linkId`);
            return false;
        }
        
        if (typeof link.pageNumber !== 'number' || link.pageNumber < 0) {
            console.error(`❌ Link validation failed: Link ${linkIdentifier} has invalid page number: ${link.pageNumber}`);
            return false;
        }
        
        linksByRole[link.role].push(link);
    }
    
    // Check that for each source link, there's a matching target link
    for (const sourceLink of linksByRole.source) {
        const matchingTarget = linksByRole.target.find(target => 
            target.linkId === sourceLink.linkId
        );
        
        if (!matchingTarget) {
            console.error(`❌ Link validation failed: Source link with linkId "${sourceLink.linkId}" on page ${sourceLink.pageNumber} has no matching target link`);
            return false;
        }
    }
    
    // Warn about orphaned target links (not a validation failure, just informational)
    for (const targetLink of linksByRole.target) {
        const matchingSource = linksByRole.source.find(source => 
            source.linkId === targetLink.linkId
        );
        
        if (!matchingSource) {
            console.warn(`⚠️  Target link with linkId "${targetLink.linkId}" on page ${targetLink.pageNumber} has no matching source link`);
        }
    }
    
    return true;
}

module.exports = {
    validate
}; 