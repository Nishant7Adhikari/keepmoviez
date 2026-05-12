# Contributing to KeepMoviEZ

First off, thank you for considering contributing to KeepMoviEZ! 🎬

KeepMoviEZ is a personal movie tracking Progressive Web App (PWA), and we welcome contributions from the community that help improve and grow the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Guidelines](#development-guidelines)
- [Pull Request Process](#pull-request-process)
- [Contact](#contact)

## Code of Conduct

This project adheres to a Code of Conduct (see `CODE_OF_CONDUCT.md`). By participating, you are expected to uphold this code. Please report unacceptable behavior via GitHub Issues.

## How Can I Contribute?

We welcome all types of contributions that align with the project's goals:

- **🐛 Bug Fixes**: Found a bug? Help us squash it!
- **✨ New Features**: Have an idea that enhances the movie tracking experience? We'd love to hear it!
- **📚 Documentation**: Improve README, add examples, or clarify existing docs [DOCS](../docs/)
- **🌍 Translations**: Help make KeepMoviEZ accessible to more users
- **🎨 UI/UX Improvements**: Make the app more beautiful and user-friendly
- **⚡ Performance Optimizations**: Speed improvements are always welcome
- **♿ Accessibility**: Help make the app usable for everyone

**Important**: Contributions should not interfere with the core motive of KeepMoviEZ as a personal movie tracking and management tool.

## Getting Started

### Prerequisites

- A GitHub account
- Basic knowledge of HTML, CSS, and JavaScript
- A text editor or IDE
- A modern web browser

### Setting Up Your Development Environment

1. **Fork the Repository**
   - Go to https://github.com/Nishant7Adhikari/keepmoviez
   - Click the "Fork" button in the top-right corner
   - This creates your own copy of the project

2. **Clone Your Fork**

   - Make a folder in your computer
   - Open the folder in your terminal via integrated terminal of VS Code or similar IDE
   - Type the given command and replace YOUR-USERNAME with your GitHub username
   ```bash
   git clone https://github.com/YOUR-USERNAME/keepmoviez.git
   cd keepmoviez
   ```
   - This will clone the repository to your local machine

3. **Open the Project**

   - In your IDE, open the folder `keepmoviez` or the name you gave it
   - open `index.html` in your browser
   - Or use a local development server

4. **Make Your Changes**
   - Create a new branch for your work:
     ```bash
     git checkout -b feature/your-feature-name
     ```
   - Make your changes and test them thoroughly

## Development Guidelines

### Code Style

We follow consistent naming conventions throughout the codebase:

#### JavaScript

- **Constants**: Use `UPPER_SNAKE_CASE`

  ```javascript
  // Example from js/constant.js
  const DEFAULT_POSTER_URL = "icons/placeholder-poster.png";
  const DO_NOT_SHOW_AGAIN_KEYS = {
    ENTRY_UPDATED: "entryUpdated",
    DAILY_REC_DISMISSED: "dailyRecDismissed",
  };
  ```

- **Variables and Functions**: Use `camelCase`

  ```javascript
  let movieData = [];
  function renderMovieCards() {
    /* ... */
  }
  ```

- **Classes**: Use `PascalCase` (if applicable)

#### JSON and Database (Supabase)

- **Column Names**: Use `snake_case`
  ```javascript
  // Example from Supabase columns
  {
    user_id: "...",
    last_modified_date: "...",
    is_deleted: false,
    watch_history: []
  }
  ```

#### CSS

- **Class Names**: Use `kebab-case` or as per the existing code
  ```css
  .movie-card {
    /* ... */
  }
  .card-thumbnail {
    /* ... */
  }
  .status-badge {
    /* ... */
  }
  ```

### Comments

- Comments are **not required** but appreciated
- If you add comments, keep them:
  - **Easy**: Simple language
  - **Short**: Brief and to the point
  - **Simple**: Explain _why_, not _what_

  ```javascript
  // Good comment
  // FIX: Strip quotes to prevent double-encoding
  if (rawPoster.startsWith('"')) {
    rawPoster = rawPoster.slice(1, -1);
  }

  // Avoid verbose comments
  // This function takes a movie object and renders it to the DOM
  // by creating HTML elements and appending them...
  ```

### File Organization

- **`js/`**: All JavaScript files
  - `main.js`: Core initialization
  - `app.js`: Main application logic
  - `ui.js`: UI rendering functions
  - `supabase.js`: Database sync logic
  - `constant.js`: Application constants
- **`style.css`**: All styles (use CSS variables for theming)
- **`index.html`**: Main HTML structure

### Testing

**Testing is not mandatory**, but please:

1. **Manually test your changes**:
   - Test the feature you added/modified
   - Check that existing features still work
   - Try in different browsers (Chrome, Firefox, Safari) if possible.
   - Test on mobile devices or mobile layout in dev tools if possible 

2. **Check the Browser Console**:
   - Make sure there are no JavaScript errors
   - Verify all resources load correctly

3. **Test Edge Cases**:
   - What happens with empty data?
   - What if a user enters unusual input?
   - Does it work offline (PWA feature)?

## Pull Request Process

**Don't worry if you're new to GitHub!** Here's a simple step-by-step guide:

### 1. Before You Start

- **Check existing issues**: Is someone already working on this?
- **Create an issue** (recommended): Describe what you want to work on
  - This helps avoid duplicate work
  - We can discuss the approach before you invest time

### 2. Making Changes

```bash
# Make sure you're on a new branch
git checkout -b fix/bug-description
# or
git checkout -b feature/feature-name

# Make your changes, then save them
git add .
git commit -m "Brief description of what you changed"
```

**Good commit messages**:

- ✅ "Fixed sync issue in auto-sync mode"
- ✅ "Added dark mode toggle to settings"
- ❌ "Fixed stuff"
- ❌ "Updates"

### 3. Push Your Changes

```bash
# Push to your fork on GitHub
git push origin your-branch-name
```

### 4. Create a Pull Request (PR)

- Go to your fork on GitHub
- You'll see a button "Compare & pull request" - click it
- Write a clear description:
  - **What** did you change?
  - **Why** did you make this change?
  - **How** did you test it?
  - Screenshots are helpful for UI changes!

### 5. Review Process

- The maintainer [@Nishant](nishantadhikari.info.np) will review your PR
- There might be feedback or requested changes
- Once approved, your contribution will be merged! 🎉

### Pull Request Checklist

Before submitting, make sure:

- [ ] Code follows the project's naming conventions
- [ ] You've tested your changes manually
- [ ] No console errors appear
- [ ] Your changes don't break existing features 
- [ ] Commit messages are clear and descriptive
- [ ] You've updated documentation if needed

## What If I'm Stuck?

No problem! Here are some options:

1. **Ask in the Issue**: Create or comment on a GitHub Issue with your question
2. **Describe Your Problem**: Include:
   - What you're trying to do
   - What you expected to happen
   - What actually happened
   - Any error messages you see

## Recognition

All contributors will be recognized! Your GitHub profile will be linked in the contributors section.

## Questions?

If you have questions about contributing, please open an issue with the label `question`.

---

**Thank you for helping make KeepMoviEZ better!** 🙏

Happy coding! 🚀