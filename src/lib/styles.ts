/**
 * Styling constants for Wednesday Worship Program Word documents.
 * Extracted and calibrated to match sample documents in lesson/
 */

export const DOCX_STYLES = {
  font: 'Calibri',
  fallbackFont: 'Times New Roman',
  // Sizes in half-points (24 = 12pt)
  fontSize: 24,
  titleSize: 24,
  
  // Spacing in dxa (twips: 20 dxa = 1 pt)
  spacing: {
    line: 276, // ~1.15 line spacing (240 is 1.0, 276 is 1.15)
    titleProgramAfter: 40,    // 2pt
    titleThemeAfter: 240,     // 12pt
    sectionAfter: 160,        // 8pt
    introAfter: 120,          // 6pt
    listItemAfter: 120,       // 6pt
  },

  // Page margins: standard 1 inch (1440 dxa) or 0.75 inch (1080 dxa)
  margins: {
    top: 1080,
    bottom: 1080,
    left: 1080,
    right: 1080,
  },
};
