// constant.js
// START CHUNK: API and Database Keys
const SUPABASE_URL = 'https://ujnjtvlkxhdbdbngdaeb.supabase.co';
// MODIFIED: Removed comment from key for professionalism
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqbmp0dmxreGhkYmRibmdkYWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNDM5NjAsImV4cCI6MjA2MzgxOTk2MH0.g1sD1xeJ05lHncxDDMUrhEiPGD8bYdyHWFJoDpq6aHs';

const TMDB_API_KEY = 'public_placeholder'; // <--- IMPORTANT: this key is setup at supabase 
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/';

const DB_NAME = 'KeepMovieZ_UserCacheDB_v2';
const DB_VERSION = 1;
const STORE_NAME = 'movieEntries';
const IDB_USER_DATA_KEY = 'userMovieData';
// END CHUNK: API and Database Keys

// START CHUNK: Application Feature Constants
const DAILY_RECOMMENDATION_ID_KEY = 'dailyRecommendationId_v2';
const DAILY_RECOMMENDATION_DATE_KEY = 'dailyRecommendationDate_v2';
const DAILY_REC_SKIP_COUNT_KEY = 'dailyRecSkipCount_v2';
const MAX_DAILY_SKIPS = 5;
const MAX_PERSONALIZED_RECS = 5;

const DO_NOT_SHOW_AGAIN_KEYS = {
    ENTRY_ADDED: 'dnsa_entryAdded',
    ENTRY_UPDATED: 'dnsa_entryUpdated',
    ENTRY_DELETED: 'dnsa_entryDeleted',
    DATA_ERASED: 'dnsa_dataErased',
    FLUX_CAPACITOR: 'dnsa_fluxCapacitor',
    TMDB_API_KEY_WARNING: 'dnsa_tmdbApiKeyWarning',
    DAILY_RECOMMENDATION_INTRO: 'dnsa_dailyRecIntro',
    LOCAL_CACHE_CORRUPT_CLEARED: 'dnsa_localCacheCorruptCleared',
    DATA_INTEGRITY_ISSUES_FOUND: 'dnsa_dataIntegrityIssuesFound',
};

const LONG_PRESS_DURATION = 500;

// Easter Egg Constants
const PRANK_TITLE_FLICKER_CHANCE = 500;
const PRANK_TOAST_CHANCE = 100;
const PRANK_ERROR_CHANCE = 200;
// END CHUNK: Application Feature Constants

// START CHUNK: Data Schema and Static Data
const CSV_HEADERS = [
    "id", "Name", "Category", "Genre", "Status", "seasonsCompleted", "currentSeasonEpisodesWatched", "Recommendation", "overallRating", "personalRecommendation",
    "Language", "Year", "Country", "Description", "Poster URL",
    "watchHistory", "relatedEntries", "Last Watched Date", "Last Watch Rating", "lastModifiedDate",
    "tmdbId", "tmdbMediaType", "keywords", "tmdb_collection_id", "tmdb_collection_name",
    "director_info", "full_cast", "production_companies", "tmdb_vote_average", "tmdb_vote_count", "runtime", "imdb_id"
];


const countryCodeToNameMap = {
    "US": "United States", "NP": "Nepal", "GB": "United Kingdom", "CA": "Canada", "AU": "Australia",
    "IN": "India", "JP": "Japan", "KR": "South Korea", "FR": "France",
    "DE": "Germany", "ES": "Spain", "IT": "Italy", "CN": "China",
    "BR": "Brazil", "MX": "Mexico", "AR": "Argentina", "RU": "Russia",
    "UK": "United Kingdom", "BD": "Bangladesh", "PK": "Pakistan", "LK": "Sri Lanka",
    "AF": "Afghanistan", "IR": "Iran", "IQ": "Iraq", "SA": "Saudi Arabia",
    "AE": "United Arab Emirates", "EG": "Egypt", "ZA": "South Africa", "NG": "Nigeria",
    "KE": "Kenya", "ET": "Ethiopia", "GH": "Ghana", "TZ": "Tanzania",
    "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland",
    "IS": "Iceland", "NL": "Netherlands", "BE": "Belgium", "CH": "Switzerland",
    "AT": "Austria", "PL": "Poland", "CZ": "Czech Republic", "HU": "Hungary",
    "GR": "Greece", "PT": "Portugal", "IE": "Ireland", "NZ": "New Zealand",
    "SG": "Singapore", "MY": "Malaysia", "TH": "Thailand", "ID": "Indonesia",
    "PH": "Philippines", "VN": "Vietnam", "HK": "Hong Kong", "TW": "Taiwan",
    "CL": "Chile", "CO": "Colombia", "PE": "Peru", "VE": "Venezuela",
    "CU": "Cuba", "PY": "Paraguay", "UY": "Uruguay", "EC": "Ecuador",
    "BO": "Bolivia", "DO": "Dominican Republic", "PR": "Puerto Rico"
};

// Updated Genre List: Removed Duplicate 'War', Added TV specific genres (Kids, News, Reality, Soap, Talk)
const ALL_GENRES = [ 
  "Action", "Adventure", "Animation", "Biopic", "Comedy", "Crime", "Disaster", "Documentary", "Drama", 
  "Family", "Fantasy", "Game", "History", "Horror", "Kids", "Legal", "Medical", "Military", "Music", "Musical", 
  "Mystery", "News", "Police", "Political", "Psychological", "Reality", "Romance", "School", "Science Fiction", 
  "Soap", "Sports", "Talk", "Thriller", "Time Travel", "Tragedy", "TV Movie", "Uplifting", "War", "Western", "Work"
].sort();

let UNIQUE_ALL_GENRES = [...new Set(ALL_GENRES.map(g => g.toLowerCase() === 'si-fi' ? 'Sci-Fi' : g))].sort();
// END CHUNK: Data Schema and Static Data

// START CHUNK: Achievements Data
const ACHIEVEMENTS = [
    // I. Core Milestones
    // Entry Addition
    { id: 'entry_add_50', name: 'The Collector - Rookie', description: 'Add 50 entries.', type: 'total_entries', threshold: 50, icon: 'fas fa-database' },
    { id: 'entry_add_300', name: 'The Archivist - Scout', description: 'Add 300 entries.', type: 'total_entries', threshold: 300, icon: 'fas fa-database' },
    { id: 'entry_add_999', name: 'The Hoarder - Elite', description: 'Add 999 entries.', type: 'total_entries', threshold: 999, icon: 'fas fa-database' },
    { id: 'entry_add_1500', name: 'Legendary Librarian - Sage', description: 'Add 1500 entries.', type: 'total_entries', threshold: 1500, icon: 'fas fa-database' },
    // Titles Watched (Overall)
    { id: 'watched_overall_64', name: 'Getting Started - Rookie', description: 'Watch 64 titles. ', type: 'total_titles_watched', threshold: 64, icon: 'fas fa-play-circle' },
    { id: 'watched_overall_256', name: 'Couch Potato - Scout', description: 'Watch 256 titles.', type: 'total_titles_watched', threshold: 256, icon: 'fas fa-couch' },
    { id: 'watched_overall_512', name: 'Cinema Awakening - Elite', description: 'Watch 512 titles.', type: 'total_titles_watched', threshold: 512, icon: 'fas fa-film' },
    { id: 'watched_overall_1024', name: 'Sacred Cinephile - Sage', description: 'Watch 1024 titles.', type: 'total_titles_watched', threshold: 1024, icon: 'fas fa-star-of-david' },
    // True Rewatcher (Distinct Titles Rewatched)
    { id: 'rewatched_distinct_5', name: 'Déjà Viewer - Rookie', description: 'Rewatch 5 distinct movies.', type: 'distinct_titles_rewatched', threshold: 5, icon: 'fas fa-redo' },
    { id: 'rewatched_distinct_10', name: 'Repeat Offender - Scout', description: 'Rewatch 10 distinct movies.', type: 'distinct_titles_rewatched', threshold: 10, icon: 'fas fa-history' },
    { id: 'rewatched_distinct_25', name: 'Familiar Fan - Elite', description: 'Rewatch 25 distinct movies.', type: 'distinct_titles_rewatched', threshold: 25, icon: 'fas fa-check-circle' },
    // Movie Marathoner (Rewatching a Single Specific Movie)
    { id: 'single_rewatch_3', name: 'Encore!', description: 'Watch the same movie 3 times.', type: 'single_title_rewatch_count', threshold: 3, icon: 'fas fa-crosshairs' },
    { id: 'single_rewatch_5', name: 'Dedicated Viewer', description: 'Watch the same movie 5 times.', type: 'single_title_rewatch_count', threshold: 5, icon: 'fas fa-heart' },
    { id: 'single_rewatch_7', name: 'Ultimate Fan', description: 'Watch the same movie 7 times.', type: 'single_title_rewatch_count', threshold: 7, icon: 'fas fa-crown' },
    // II. Category-Specific Achievements
    // Movie Buff
    { id: 'movie_watched_75', name: 'Movie Goer - Rookie', description: 'Watch 75 Movies.', type: 'category_watched_count', category: 'Movie', threshold: 75, icon: 'fas fa-ticket-alt' },
    { id: 'movie_watched_350', name: 'Movie Maniac - Scout', description: 'Watch 350 Movies.', type: 'category_watched_count', category: 'Movie', threshold: 350, icon: 'fas fa-film' },
    { id: 'movie_watched_750', name: 'Film Fanatic - Elite', description: 'Watch 750 Movies.', type: 'category_watched_count', category: 'Movie', threshold: 750, icon: 'fas fa-video' },
    // Series Fan
    { id: 'series_watched_15', name: 'Episode Explorer - Rookie', description: 'Watch 15 Series.', type: 'category_watched_count', category: 'Series', threshold: 15, icon: 'fas fa-tv' },
    { id: 'series_watched_75', name: 'Binge Watcher - Scout', description: 'Watch 75 Series.', type: 'category_watched_count', category: 'Series', threshold: 75, icon: 'fas fa-broadcast-tower' },
    { id: 'series_watched_150', name: 'Series Specialist - Elite', description: 'Watch 150 Series.', type: 'category_watched_count', category: 'Series', threshold: 150, icon: 'fas fa-satellite-dish' },
    // Series Loyalty (Completing Long Series)
    { id: 'long_series_3', name: 'Commitment Ceremony - Rookie', description: 'Watch 3 long series (3+ seasons or 40+ episodes).', type: 'long_series_watched_count', threshold: 3, minSeasons: 3, minEpisodes: 40, icon: 'fas fa-user-clock' },
    { id: 'long_series_9', name: 'Saga Survivor - Scout', description: 'Watch 9 long series (3+ seasons or 40+ episodes).', type: 'long_series_watched_count', threshold: 9, minSeasons: 3, minEpisodes: 40, icon: 'fas fa-calendar-check' },
    { id: 'long_series_15', name: 'Epic Journey - Elite', description: 'Watch 15 long series (3+ seasons or 40+ episodes).', type: 'long_series_watched_count', threshold: 15, minSeasons: 3, minEpisodes: 40, icon: 'fas fa-scroll' },
    // Documentary Devotee
    { id: 'docu_watched_5', name: 'Truth Seeker - Rookie', description: 'Watch 5 Documentaries.', type: 'category_watched_count', category: 'Documentary', threshold: 5, icon: 'fas fa-book-open' },
    { id: 'docu_watched_15', name: 'Fact Finder - Scout', description: 'Watch 15 Documentaries.', type: 'category_watched_count', category: 'Documentary', threshold: 15, icon: 'fas fa-search' },
    { id: 'docu_watched_30', name: 'Reality Scholar - Elite', description: 'Watch 30 Documentaries.', type: 'category_watched_count', category: 'Documentary', threshold: 30, icon: 'fas fa-microscope' },
    // Special Appreciator
    { id: 'special_watched_25', name: 'One-Off Wonder', description: 'Watch 25 Specials.', type: 'category_watched_count', category: 'Special', threshold: 25, icon: 'fas fa-star' },
    { id: 'special_watched_75', name: 'Event Viewer', description: 'Watch 75 Specials.', type: 'category_watched_count', category: 'Special', threshold: 75, icon: 'far fa-calendar-alt' },
    // III. Genre Mastery
    { id: 'action_watched_25', name: 'Adrenaline Junkie - Rookie', description: 'Watch 25 Action titles.', type: 'genre_watched_count', genre: 'Action', threshold: 25, icon: 'fas fa-bomb' },
    { id: 'action_watched_100', name: 'Explosion Expert - Scout', description: 'Watch 100 Action titles.', type: 'genre_watched_count', genre: 'Action', threshold: 100, icon: 'fas fa-fighter-jet' },
    { id: 'action_watched_175', name: 'Action Hero - Elite', description: 'Watch 175 Action titles.', type: 'genre_watched_count', genre: 'Action', threshold: 175, icon: 'fas fa-fist-raised' },
    { id: 'comedy_watched_25', name: 'Giggle Getter - Rookie', description: 'Watch 25 Comedy titles.', type: 'genre_watched_count', genre: 'Comedy', threshold: 25, icon: 'fas fa-laugh-beam' },
    { id: 'comedy_watched_100', name: 'Humor Honcho - Scout', description: 'Watch 100 Comedy titles.', type: 'genre_watched_count', genre: 'Comedy', threshold: 100, icon: 'fas fa-smile-wink' },
    { id: 'comedy_watched_175', name: 'Comedy Legend - Elite', description: 'Watch 175 Comedy titles.', type: 'genre_watched_count', genre: 'Comedy', threshold: 175, icon: 'fas fa-theater-masks' },
    { id: 'drama_watched_25', name: 'Emotion Explorer - Rookie', description: 'Watch 25 Drama titles.', type: 'genre_watched_count', genre: 'Drama', threshold: 25, icon: 'fas fa-sad-tear' },
    { id: 'drama_watched_100', name: 'Story Seeker - Scout', description: 'Watch 100 Drama titles.', type: 'genre_watched_count', genre: 'Drama', threshold: 100, icon: 'fas fa-book' },
    { id: 'drama_watched_175', name: 'Dramatic Depths - Elite', description: 'Watch 175 Drama titles.', type: 'genre_watched_count', genre: 'Drama', threshold: 175, icon: 'fas fa-feather-alt' },
    { id: 'scifi_watched_20', name: 'Future Fan - Rookie', description: 'Watch 20 Science Fiction titles.', type: 'genre_watched_count', genre: 'Science Fiction', threshold: 20, icon: 'fas fa-rocket' },
    { id: 'scifi_watched_50', name: 'Tech Tinkerer - Scout', description: 'Watch 50 Science Fiction titles.', type: 'genre_watched_count', genre: 'Science Fiction', threshold: 50, icon: 'fas fa-microchip' },
    { id: 'scifi_watched_75', name: 'Galaxy Guardian - Elite', description: 'Watch 75 Science Fiction titles.', type: 'genre_watched_count', genre: 'Science Fiction', threshold: 75, icon: 'fas fa-user-astronaut' },
    { id: 'horror_watched_10', name: 'Spook Seeker - Rookie', description: 'Watch 10 Horror titles.', type: 'genre_watched_count', genre: 'Horror', threshold: 10, icon: 'fas fa-ghost' },
    { id: 'horror_watched_30', name: 'Fright Fan - Scout', description: 'Watch 30 Horror titles.', type: 'genre_watched_count', genre: 'Horror', threshold: 30, icon: 'fas fa-spider' },
    { id: 'horror_watched_75', name: 'Fearless Fiend - Elite', description: 'Watch 75 Horror titles.', type: 'genre_watched_count', genre: 'Horror', threshold: 75, icon: 'fas fa-skull-crossbones' },
    { id: 'fantasy_watched_10', name: 'Magic Believer - Rookie', description: 'Watch 10 Fantasy titles.', type: 'genre_watched_count', genre: 'Fantasy', threshold: 10, icon: 'fas fa-hat-wizard' },
    { id: 'fantasy_watched_30', name: 'Dragon Rider - Scout', description: 'Watch 30 Fantasy titles.', type: 'genre_watched_count', genre: 'Fantasy', threshold: 30, icon: 'fas fa-dragon' },
    { id: 'fantasy_watched_75', name: 'Realm Ruler - Elite', description: 'Watch 75 Fantasy titles.', type: 'genre_watched_count', genre: 'Fantasy', threshold: 75, icon: 'fas fa-dungeon' },
    { id: 'thriller_watched_10', name: 'Suspense Starter - Rookie', description: 'Watch 10 Thriller titles.', type: 'genre_watched_count', genre: 'Thriller', threshold: 10, icon: 'fas fa-bolt' },
    { id: 'thriller_watched_30', name: 'Edge of Seat - Scout', description: 'Watch 30 Thriller titles.', type: 'genre_watched_count', genre: 'Thriller', threshold: 30, icon: 'fas fa-user-secret' },
    { id: 'thriller_watched_75', name: 'Master of Suspense - Elite', description: 'Watch 75 Thriller titles.', type: 'genre_watched_count', genre: 'Thriller', threshold: 75, icon: 'fas fa-low-vision' },
    { id: 'animation_watched_10', name: 'Cartoon Cadet - Rookie', description: 'Watch 10 Animation titles.', type: 'genre_watched_count', genre: 'Animation', threshold: 10, icon: 'fas fa-mouse-pointer' },
    { id: 'animation_watched_30', name: 'Cel Champion - Scout', description: 'Watch 30 Animation titles.', type: 'genre_watched_count', genre: 'Animation', threshold: 30, icon: 'fas fa-palette' },
    { id: 'animation_watched_75', name: 'Animation Ace - Elite', description: 'Watch 75 Animation titles.', type: 'genre_watched_count', genre: 'Animation', threshold: 75, icon: 'fas fa-film' },
    { id: 'romance_watched_10', name: 'Heartfelt Hopeful - Rookie', description: 'Watch 10 Romance titles.', type: 'genre_watched_count', genre: 'Romance', threshold: 10, icon: 'fas fa-heart' },
    { id: 'romance_watched_30', name: 'Love Linguist - Scout', description: 'Watch 30 Romance titles.', type: 'genre_watched_count', genre: 'Romance', threshold: 30, icon: 'fas fa-kiss-wink-heart' },
    { id: 'romance_watched_75', name: 'Cupid\'s Confidant - Elite', description: 'Watch 75 Romance titles.', type: 'genre_watched_count', genre: 'Romance', threshold: 75, icon: 'fas fa-dove' },
    { id: 'hist_watched_15', name: 'Historical Buff', description: 'Watch 15 Historical titles.', type: 'genre_watched_count', genre: 'History', threshold: 15, icon: 'fas fa-landmark' },
    { id: 'musical_watched_15', name: 'Musical Maestro', description: 'Watch 15 Musical titles.', type: 'genre_watched_count', genre: 'Music', threshold: 15, icon: 'fas fa-music' },
    { id: 'mystery_watched_15', name: 'Mystery Solver', description: 'Watch 15 Mystery titles.', type: 'genre_watched_count', genre: 'Mystery', threshold: 15, icon: 'fas fa-search' },
    { id: 'crime_watched_15', name: 'Crime Scene Investigator', description: 'Watch 15 Crime titles.', type: 'genre_watched_count', genre: 'Crime', threshold: 15, icon: 'fas fa-fingerprint' },
    { id: 'genre_variety_5', name: 'Genre Dabbler - Rookie', description: 'Watch titles from 5 different genres.', type: 'genre_variety_count', threshold: 5, icon: 'fas fa-random' },
    { id: 'genre_variety_10', name: 'Genre Hopper - Scout', description: 'Watch titles from 10 different genres.', type: 'genre_variety_count', threshold: 10, icon: 'fas fa-palette' },
    { id: 'genre_variety_20', name: 'Genre Chameleon - Elite', description: 'Watch titles from 20 different genres.', type: 'genre_variety_count', threshold: 20, icon: 'fas fa-swatchbook' },
    // IV. Rating & Recommendation Achievements
    { id: 'rated_150', name: 'Budding Reviewer - Rookie', description: 'Rate 150 titles.', type: 'rated_titles_count', threshold: 150, icon: 'fas fa-star-half-alt' },
    { id: 'rated_555', name: 'Opinionated Viewer - Scout', description: 'Rate 555 titles.', type: 'rated_titles_count', threshold: 555, icon: 'fas fa-pen-nib' },
    { id: 'rated_999', name: 'Distinguished Rater - Elite', description: 'Rate 999 titles.', type: 'rated_titles_count', threshold: 999, icon: 'fas fa-award' },
    { id: 'fivestar_5', name: 'Gold Star Giver - Rookie', description: 'Rate 5 titles with 5 stars.', type: 'specific_rating_count', rating: '5', threshold: 5, icon: 'fas fa-star' },
    { id: 'fivestar_25', name: 'Perfectionist - Scout', description: 'Rate 25 titles with 5 stars.', type: 'specific_rating_count', rating: '5', threshold: 25, icon: 'fas fa-star' },
    { id: 'fivestar_75', name: 'Gold Standard - Elite', description: 'Rate 75 titles with 5 stars.', type: 'specific_rating_count', rating: '5', threshold: 75, icon: 'fas fa-medal' },
    { id: 'highly_rec_25', name: 'Good Taste - Rookie', description: 'Mark 25 titles as "Highly Recommended".', type: 'recommendation_level_count', recommendation: 'Highly Recommended', threshold: 25, icon: 'fas fa-thumbs-up' },
    { id: 'highly_rec_55', name: 'Top Tier Tastes - Scout', description: 'Mark 55 titles as "Highly Recommended".', type: 'recommendation_level_count', recommendation: 'Highly Recommended', threshold: 55, icon: 'fas fa-poll-h' },
    { id: 'highly_rec_99', name: 'Elite Recommender - Elite', description: 'Mark 99 titles as "Highly Recommended".', type: 'recommendation_level_count', recommendation: 'Highly Recommended', threshold: 99, icon: 'fas fa-certificate' },
    // V. Temporal & Completion Achievements
    { id: 'decade_variety_3', name: 'Time Traveler - Rookie', description: 'Watch titles from 3 different decades.', type: 'decade_variety_count', threshold: 3, icon: 'fas fa-calendar-alt' },
    { id: 'decade_variety_5', name: 'Century Spanner - Scout', description: 'Watch titles from 5 different decades.', type: 'decade_variety_count', threshold: 5, icon: 'fas fa-history' },
    { id: 'decade_variety_10', name: 'Epoch Voyager - Elite', description: 'Watch titles from 10 different decades.', type: 'decade_variety_count', threshold: 10, icon: 'fas fa-hourglass-half' },
    { id: 'classic_connoisseur_10', name: 'Classic Connoisseur', description: 'Watch 10 titles released before 1980.', type: 'pre_year_watched_count', year: 1980, threshold: 10, icon: 'fas fa-film' },
    { id: 'contemporary_critic_50', name: 'Contemporary Critic', description: 'Watch 50 titles released in the last 5 years.', type: 'recent_years_watched_count', yearsAgo: 5, threshold: 50, icon: 'fas fa-glasses' },
    { id: 'backlog_watched_20', name: 'List Clearer - Rookie', description: 'Mark 100 entries as Watched.', type: 'status_count', status: 'Watched', threshold: 100, icon: 'fas fa-check-double' },
    { id: 'backlog_watched_365', name: 'Queue Conqueror - Scout', description: 'Mark 365 entries as Watched.', type: 'status_count', status: 'Watched', threshold: 365, icon: 'fas fa-clipboard-check' },
    { id: 'backlog_watched_999', name: 'Completionist Prime - Elite', description: 'Mark 999 entries as Watched.', type: 'status_count', status: 'Watched', threshold: 999, icon: 'fas fa-tasks' },
    { id: 'continue_active_3', name: 'Juggler - Rookie', description: 'Have 3 titles in "Continue" status.', type: 'status_count_active', status: 'Continue', threshold: 3, icon: 'fas fa-stream' },
    { id: 'continue_active_7', name: 'Multi-Tasker - Scout', description: 'Have 7 titles in "Continue" status.', type: 'status_count_active', status: 'Continue', threshold: 7, icon: 'fas fa-layer-group' },
    { id: 'continue_active_12', name: 'Serial Watcher - Elite', description: 'Have 12 titles in "Continue" status.', type: 'status_count_active', status: 'Continue', threshold: 12, icon: 'fas fa-infinity' },
    { id: 'active_days_100', name: 'Regular User - Rookie', description: 'Use the app on 100 different days.', type: 'active_days_count', threshold: 100, icon: 'fas fa-calendar-day' },
    { id: 'active_days_300', name: 'Consistent Viewer - Scout', description: 'Use the app on 300 different days.', type: 'active_days_count', threshold: 300, icon: 'fas fa-calendar-alt' },
    { id: 'active_days_600', name: 'Habitual User - Elite', description: 'Use the app on 600 different days.', type: 'active_days_count', threshold: 600, icon: 'fas fa-user-clock' },
    { id: 'weekend_warrior_3', name: 'Weekend Warrior', description: 'Log 3 watch instances over a single weekend (Sat/Sun).', type: 'weekend_watch_streak', threshold: 3, icon: 'fas fa-calendar-week' },
    { id: 'perfect_week_7', name: 'Perfect Week', description: 'Log a watched item every day for 7 consecutive days.', type: 'consecutive_daily_watch_streak', threshold: 7, icon: 'fas fa-calendar-check' },
    // VI. Geographical & Linguistic Achievements
    { id: 'country_variety_5', name: 'World Curious - Rookie', description: 'Watch titles from 5 different countries.', type: 'country_variety_count', threshold: 5, icon: 'fas fa-globe-americas' },
    { id: 'country_variety_10', name: 'World Cinema Wanderer - Scout', description: 'Watch titles from 10 different countries.', type: 'country_variety_count', threshold: 10, icon: 'fas fa-map-marked-alt' },
    { id: 'country_variety_20', name: 'International Film Diplomat - Elite', description: 'Watch titles from 20 different countries.', type: 'country_variety_count', threshold: 20, icon: 'fas fa-passport' },
    { id: 'lang_variety_5', name: 'Language Sampler - Rookie', description: 'Watch titles in 5 different languages.', type: 'language_variety_count', threshold: 5, icon: 'fas fa-language' },
    { id: 'lang_variety_15', name: 'Linguistic Explorer - Scout', description: 'Watch titles in 15 different languages.', type: 'language_variety_count', threshold: 15, icon: 'fas fa-comments' },
    { id: 'lang_variety_50', name: 'Master of Subtitles - Elite', description: 'Watch titles in 50 different languages.', type: 'language_variety_count', threshold: 50, icon: 'fas fa-closed-captioning' },
    // VII. Feature Usage & Fun Achievements
    { id: 'sync_25', name: 'Sync Starter - Rookie', description: 'Perform cloud sync 25 times.', type: 'sync_count', threshold: 25, icon: 'fas fa-sync-alt' },
    { id: 'sync_250', name: 'Cloud Connector - Scout', description: 'Perform cloud sync 250 times.', type: 'sync_count', threshold: 250, icon: 'fas fa-cloud-upload-alt' },
    // Removed: Sync Sensei (High Threshold)
    { id: 'stats_opened_100', name: 'Stats Nerd', description: 'Open any stats/insights modal 100 times.', type: 'stats_modal_opened_count', threshold: 100, icon: 'fas fa-chart-bar' },
    { id: 'night_owl_watch', name: 'Night Owl', description: 'Log a watch instance between 12 AM and 4 AM.', type: 'time_of_day_watch', period: 'night', threshold: 1, icon: 'fas fa-moon' },
    { id: 'early_bird_watch', name: 'Early Bird', description: 'Log a watch instance between 5 AM and 8 AM.', type: 'time_of_day_watch', period: 'early_morning', threshold: 1, icon: 'fas fa-sun' },
    { id: 'desc_detail_10', name: 'Detail Oriented', description: 'Write descriptions >30 characters for 10 entries.', type: 'detailed_description_count', minLength: 30, threshold: 10, icon: 'fas fa-file-alt' },
    { id: 'franchise_3', name: 'Trilogy Tracker - Rookie', description: 'Watch 3 titles from the same TMDB collection.', type: 'tmdb_collection_streak_count', threshold: 3, icon: 'fas fa-project-diagram' },
    { id: 'franchise_5', name: 'Saga Seeker - Scout', description: 'Watch 5 titles from the same TMDB collection.', type: 'tmdb_collection_streak_count', threshold: 5, icon: 'fas fa-sitemap' },
    { id: 'franchise_all_5plus', name: 'Collection Completer - Elite', description: 'Watch all titles from a TMDB collection of 5+ entries.', type: 'tmdb_collection_completed_count', minCollectionSize: 5, threshold: 1, icon: 'fas fa-check-circle' },
    { id: 'director_3', name: 'Director Dabbler - Rookie', description: 'Watch 3 titles by the same director.', type: 'director_streak_count', threshold: 3, icon: 'fas fa-video' },
    { id: 'director_5', name: 'Auteur Admirer - Scout', description: 'Watch 5 titles by the same director.', type: 'director_streak_count', threshold: 5, icon: 'fas fa-user-tie' },
    { id: 'director_10', name: 'Director Devotee - Elite', description: 'Watch 10 titles by the same director.', type: 'director_streak_count', threshold: 10, icon: 'fas fa-bullhorn' },
    { id: 'studio_3', name: 'Studio Scout - Rookie', description: 'Watch 3 titles from the same major studio.', type: 'studio_streak_count', threshold: 3, icon: 'fas fa-industry' },
    { id: 'studio_7', name: 'Production Pro - Scout', description: 'Watch 7 titles from the same major studio.', type: 'studio_streak_count', threshold: 7, icon: 'fas fa-building' },
    { id: 'studio_15', name: 'Mogul Monitor - Elite', description: 'Watch 15 titles from the same major studio.', type: 'studio_streak_count', threshold: 15, icon: 'fas fa-city' },
    { id: 'links_5', name: 'Connector', description: 'Manually link 5 pairs of related entries.', type: 'manual_links_count', threshold: 5, icon: 'fas fa-link' },
    { id: 'themed_spree_3', name: 'Themed Spree', description: 'Watch 3 titles of the same specific genre within 7 days.', type: 'genre_streak_short_term', count: 3, days: 7, threshold: 1, icon: 'fas fa-tags' },
    { id: 'hidden_gem_5', name: 'Gem Finder - Rookie', description: 'Watch 5 titles with <1000 TMDB votes but TMDB rating > 7.0.', type: 'hidden_gem_count', tmdbVotesMax: 1000, tmdbRatingMin: 7.0, threshold: 5, icon: 'fas fa-search-dollar' },
    { id: 'hidden_gem_7', name: 'Diamond in Rough - Scout', description: 'Watch 7 titles with <1000 TMDB votes but TMDB rating > 7.0.', type: 'hidden_gem_count', tmdbVotesMax: 1000, tmdbRatingMin: 7.0, threshold: 7, icon: 'fas fa-gem' },
    { id: 'hidden_gem_15', name: 'Treasure Hunter - Elite', description: 'Watch 15 titles with <1000 TMDB votes but TMDB rating > 7.0.', type: 'hidden_gem_count', tmdbVotesMax: 1000, tmdbRatingMin: 7.0, threshold: 15, icon: 'fas fa-map-pin' },
    { id: 'daily_rec_watched_5', name: 'Daily Dabbler - Rookie', description: 'Watch the Daily Recommendation 5 times.', type: 'daily_recommendation_watched_count', threshold: 5, icon: 'fas fa-gift' },
    { id: 'daily_rec_watched_15', name: 'Picky Pro - Scout', description: 'Watch the Daily Recommendation 15 times.', type: 'daily_recommendation_watched_count', threshold: 15, icon: 'fas fa-calendar-check' },
    { id: 'daily_rec_watched_30', name: 'Suggestion Sovereign - Elite', description: 'Watch the Daily Recommendation 30 times.', type: 'daily_recommendation_watched_count', threshold: 30, icon: 'fas fa-crown' },
    // Special Title Achievements
    { id: 'special_your_name', name: 'Destined Encounter', description: 'Watch "Your Name" (Kimi no Na wa). ❤️', type: 'special_title_watch', titleNames: ['Your Name', 'Kimi no Na wa.'], threshold: 1, icon: 'fas fa-comet' },

    // VIII. "Meta" Achievements
    { id: 'meta_bronze_15', name: 'Bronze Collector', description: 'Achieve 15 other achievements.', type: 'meta_achievement_count', threshold: 15, icon: 'fas fa-trophy' },
    { id: 'meta_silver_25', name: 'Silver Collector', description: 'Achieve 25 other achievements.', type: 'meta_achievement_count', threshold: 25, icon: 'fas fa-trophy' },
    { id: 'meta_gold_50', name: 'Gold Collector', description: 'Achieve 50 other achievements.', type: 'meta_achievement_count', threshold: 50, icon: 'fas fa-trophy' },
    { id: 'meta_platinum_75', name: 'Platinum Collector', description: 'Achieve 75 other achievements.', type: 'meta_achievement_count', threshold: 75, icon: 'fas fa-trophy' },
    { id: 'meta_diamond_100', name: 'Diamond Collector', description: 'Achieve 100+ other achievements.', type: 'meta_achievement_count', threshold: 100, icon: 'fas fa-trophy' },
];
// END CHUNK: Achievements Data

// START CHUNK: Global State and Initialization
let supabase = null;
try {
    if (typeof SUPABASE_URL !== 'undefined' && typeof SUPABASE_ANON_KEY !== 'undefined' &&
        SUPABASE_URL && SUPABASE_ANON_KEY &&
        SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {

        if (window.supabase && typeof window.supabase.createClient === 'function') {
            // FIX: Explicitly set storage to localStorage to prevent session storage fallback
            // This ensures login persists across browser closes/refreshes
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    autoRefreshToken: true,
                    persistSession: true,
                    detectSessionInUrl: true,
                    storage: window.localStorage 
                }
            });
            console.log("Supabase client initialized successfully.");
        } else {
            console.error("Supabase JS library (V2) not found or createClient is not a function. Ensure it's correctly included in index.html before this script.");
        }
    } else {
        console.warn("SUPABASE_URL or SUPABASE_ANON_KEY is not configured correctly in constants.js. Supabase features will be disabled.");
    }
} catch (error) {
    console.error("Error initializing Supabase client:", error);
    supabase = null;
}

window.supabaseClient = supabase;

// Global variables for app state (Moved to top level for global access)
window.movieData = []; // Explicitly window.movieData to ensure global access
var movieData = window.movieData; // Alias for local usage

let selectedEntryIds = [];
var isMultiSelectMode = false;
let longPressTimer = null;
let longPressOccurred = false;

let activeFilters = {
    category: 'all',
    country: 'all',
    language: 'all',
    genres: [],
    genreLogic: 'AND'
};
let selectedGenres = []; // For the entry modal
let selectedFilterGenres = []; // For the filter modal

// DOM Element References
let loadingOverlay, themeTransitionOverlay, authContainer, appContent;
let appMenu, appMenuBackdrop, menuLoggedInUserEmail, menuOnlineStatusIndicator, menuThemeToggleBtn, menuCsvFileUploader,
    menuDownloadCsvBtn, menuDownloadJsonBtn, menuSyncDataBtn, menuEraseDataBtn, menuSupabaseLogoutBtn;
let filterInputNavbar;
let formFieldsGlob = {};
let watchInstanceFormFields = {};

// Data stores
let currentSortColumn = 'Name';
let currentSortDirection = 'asc';
let filterQuery = '';

// App state
let preferredTimeFormat = localStorage.getItem('preferredTimeFormat') || 'days'; // 'days' or 'hours'
let knownUnlockedAchievements = new Set(); // For new achievement notifications

// Modal related state
let movieIdToDelete = null;
let pendingEntryForConfirmation = null;
let pendingEditIdForConfirmation = null;

// Stats related
const chartInstances = {};
window.globalStatsData = {}; // Explicitly global
var globalStatsData = window.globalStatsData;

// IndexedDB
let db;

window.isExplicitLogout = false;

function initializeDOMElements() {
    loadingOverlay = document.getElementById('loadingOverlay');
    themeTransitionOverlay = document.getElementById('themeTransitionOverlay');
    authContainer = document.getElementById('authContainer');
    appContent = document.getElementById('appContent');
    appMenu = document.getElementById('appMenu');
    appMenuBackdrop = document.getElementById('appMenuBackdrop');
    menuLoggedInUserEmail = document.getElementById('menuLoggedInUserEmail');
    menuOnlineStatusIndicator = document.getElementById('menuOnlineStatusIndicator');
    menuThemeToggleBtn = document.getElementById('menuThemeToggleBtn');
    menuCsvFileUploader = document.getElementById('menuCsvFileUploader');
    menuDownloadCsvBtn = document.getElementById('menuDownloadCsvBtn');
    menuDownloadJsonBtn = document.getElementById('menuDownloadJsonBtn');
    menuSyncDataBtn = document.getElementById('menuSyncDataBtn');
    menuEraseDataBtn = document.getElementById('menuEraseDataBtn');
    menuSupabaseLogoutBtn = document.getElementById('menuSupabaseLogoutBtn');
    filterInputNavbar = document.getElementById('filterInputNavbar');

    formFieldsGlob = {
        name: document.getElementById('movieName'),
        category: document.getElementById('category'),
        status: document.getElementById('status'),
        recommendation: document.getElementById('recommendation'),
        seasonsCompleted: document.getElementById('seasonsCompleted'),
        currentSeasonEpisodesWatched: document.getElementById('currentSeasonEpisodesWatched'),
        runtimeMovie: document.getElementById('runtimeMovie'),
        runtimeSeriesSeasons: document.getElementById('runtimeSeriesSeasons'),
        runtimeSeriesEpisodes: document.getElementById('runtimeSeriesEpisodes'),
        runtimeSeriesAvgEp: document.getElementById('runtimeSeriesAvgEp'),
        overallRating: document.getElementById('overallRating'),
        personalRecommendation: document.getElementById('personalRecommendation'),
        description: document.getElementById('description'),
        language: document.getElementById('language'),
        year: document.getElementById('year'),
        country: document.getElementById('country'),
        posterUrl: document.getElementById('posterUrl'),
        tmdbId: document.getElementById('tmdbId'),
        tmdbMediaType: document.getElementById('tmdbMediaType'),
        tmdbSearchYear: document.getElementById('tmdbSearchYear'),
        relatedEntriesNames: document.getElementById('relatedEntriesNames'),
        relatedEntriesSuggestions: document.getElementById('relatedEntriesSuggestions')
    };

    watchInstanceFormFields = {
        date: document.getElementById('watchDate'),
        rating: document.getElementById('watchRating'),
        notes: document.getElementById('watchNotes')
    };

    const criticalElements = { ...formFieldsGlob, ...watchInstanceFormFields, loadingOverlay, authContainer, appContent };
    for (const key in criticalElements) {
        if (!criticalElements[key]) {
            console.error(`CRITICAL DOM ERROR: Element for '${key}' not found.`);
            document.body.innerHTML = "<p style='color:red;padding:2rem;text-align:center;'>Critical UI element missing. App cannot start.</p>";
        }
    }
}
// END CHUNK: Global State and Initialization