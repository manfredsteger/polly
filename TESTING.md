# KITA Poll System - Testing Guide

## Permanent Example URLs for Development

Save these URLs as bookmarks for easy testing of all features:

### 📊 Example Survey - "KITA Sommerfest Aktivitäten 2025"
A classic survey where users vote for their favorite summer festival activities. **Now with beautiful SVG images!**

- **Public URL (for voting)**: http://localhost:5000/poll/example-survey-public-2HBD_6QRkmWXAFW0C1dE
- **Admin URL (for management)**: http://localhost:5000/admin/example-survey-admin-S3O3K40gXfe3v_xGgl2T
- **Results URL (direct to results)**: http://localhost:5000/poll/example-survey-public-2HBD_6QRkmWXAFW0C1dE#results

**Features to test:**
- Classic survey voting (Ja/Vielleicht/Nein)
- Beautiful, colorful SVG images for each option
- Image lightbox with voting functionality
- Alt text accessibility features
- Results visualization with thumbnails
- PDF/CSV export functionality
- Email notifications

**Survey includes images for:**
- 🏰 Hüpfburg und Spielgeräte (Bounce house with happy children)
- 🎨 Kinderschminken (Face painting with butterfly design)
- ✂️ Bastelstation (Craft station with supplies)
- 🍖 Grillstation mit Würstchen (BBQ grill with sausages)
- 🎵 Musik und Tanz (Children dancing to music)

### 📅 Example Date Poll - "Elternabend Terminplanung"
A scheduling poll for finding the best meeting time.

- **Public URL (for voting)**: http://localhost:5000/poll/example-poll-public-JS_sF-UiedqeIXhFbOfV
- **Admin URL (for management)**: http://localhost:5000/admin/example-poll-admin-0dyW1qaEC7nx_iyPlrVi
- **Results URL (direct to results)**: http://localhost:5000/poll/example-poll-public-JS_sF-UiedqeIXhFbOfV#results

**Features to test:**
- Date/time scheduling interface
- Calendar-based options
- Time slot voting
- Best time recommendations

## Maintenance Scripts

### Create Fresh Examples
```bash
NODE_ENV=development tsx scripts/create-examples.ts
```

### Update Examples with Latest Features
```bash
NODE_ENV=development tsx scripts/update-examples.ts
```

### Add Beautiful Images to Survey
```bash
NODE_ENV=development tsx scripts/add-images-to-examples.ts
```

## Development Workflow

1. **Make code changes** to implement new features
2. **Test with example URLs** - no need to create new polls each time
3. **Update examples** if needed with the update script
4. **Save URLs as bookmarks** for quick access during development

## Sample Data

The examples include:
- **Survey with 5 activity options** - Now with beautiful, colorful SVG images!
  - Professional illustrations for each summer festival activity
  - Detailed alt text for full accessibility testing
  - Lightbox functionality with voting controls
- **Date poll with 4 time slot options** for next week
- **Complete German localization** throughout
- **KITA brand styling** with authentic colors
- **Full accessibility features** including screen reader support

**SVG Images Include:**
- Custom-designed illustrations for each survey option
- Bright, child-friendly colors and themes
- Professional quality artwork
- Optimized for web display and accessibility

These permanent examples make development much faster since you don't need to recreate polls every time you test changes!