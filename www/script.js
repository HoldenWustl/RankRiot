import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, updateDoc, increment, setDoc, getDocs, deleteDoc, where, addDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCGY7NSNr1z97FMCi1IPyDVtmPnd74wsuE",
    authDomain: "rankriot-b7b84.firebaseapp.com",
    projectId: "rankriot-b7b84",
    storageBucket: "rankriot-b7b84.firebasestorage.app",
    messagingSenderId: "1029848269607",
    appId: "1:1029848269607:web:881b4ecfca6eb4c1b29f02",
    measurementId: "G-4FVHVKME1E"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- AUDIO ARSENAL ---
// You can replace these URLs with local files later (e.g., 'sounds/start.mp3')
const sfxStart = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'); // Arcade start
const sfxMenu = new Audio('https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3'); // UI Click
const sfxOvertake = new Audio('https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3'); // Whoosh / Level up
sfxOvertake.volume = 0.25;
// This function resets the sound to 0ms every time it plays, allowing fast spamming!
function playSound(audioClip) {
    audioClip.currentTime = 0; 
    audioClip.play().catch(e => console.log("Browser blocked auto-play until user clicks:", e));
}

// --- UI / Screen Management ---
const screens = {
    splash: document.getElementById('splash-screen'),
    category: document.getElementById('category-screen'),
    game: document.getElementById('game-screen')
};
const rankingList = document.getElementById('ranking-list');
const comboBarFill = document.getElementById('combo-bar-fill');
const comboText = document.getElementById('combo-text');
const currentListTitle = document.getElementById('current-list-title');
const body = document.body;
// --- GLOBAL BOOST STATE ---
let isDoubleClicksActive = false;
// --- AUDIO DOPAMINE (Web Audio API) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
// --- GLOBAL ALERTS LISTENER ---
const globalTickerContainer = document.getElementById('global-ticker-container');
const globalTickerText = document.getElementById('global-ticker-text');
const categoryTickerContent = document.getElementById('ticker-content');
const categoryTickerClone = document.getElementById('ticker-content-clone');

let initialTickerLoad = true;
// Start with some default arcade text
let recentTickerMessages = [
    "SYSTEM ONLINE", 
    "WAITING FOR FIRST BLOOD", 
    "CHOOSE YOUR BATTLEFIELD"
];

// --- 2X REWARDED AD LOGIC ---
const adBtn = document.getElementById('double-click-ad-btn');

if (adBtn) {
    adBtn.addEventListener('click', () => {
        // Prevent clicking if the timer is already running
        if (isDoubleClicksActive) return;

        // 1. Show the "Ad"
        alert("Simulating Ad: Imagine a 15-second video of a fake mobile game here!");

        // 2. Activate the Boost
        isDoubleClicksActive = true;
        let timeLeft = 30;

        // 3. Change Button Styling to "Active Mode"
        adBtn.classList.add('active-boost');

        // 4. Start the Countdown
        const timerInterval = setInterval(() => {
            timeLeft--;
            
            if (timeLeft > 0) {
                adBtn.innerHTML = `🔥 2X ACTIVE: ${timeLeft}s`;
            } else {
                // 5. Timer reaches 0, reset everything
                clearInterval(timerInterval);
                isDoubleClicksActive = false;
                
                // Revert to original styling & structure
                adBtn.classList.remove('active-boost');
                adBtn.innerHTML = `
                    <span class="ad-icon">📺</span>
                    <span id="ad-text">2X VOTES</span>
                `;
            }
        }, 1000); // Runs every 1000 milliseconds (1 second)
    });
}
// ==========================================
// 🕒 DAILY ROTATION & TIMER LOGIC
// ==========================================

function setupDailyRotation() {
    const masterList = document.getElementById('master-list');
    const activeList = document.getElementById('active-list');
    const upcomingList = document.getElementById('upcoming-list');

    if (!masterList) return;

    // Grab all 38 cards from the hidden vault
    const allCards = Array.from(masterList.querySelectorAll('.cat-card'));
    const totalCats = allCards.length;
    const catsPerDay = 5;

    // 1. Get the exact current time in New York (EST/EDT)
    const nyTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));

    // 2. Create a Universal "Day Index"
    // This creates an absolute number (e.g., Day 19820) that changes EXACTLY at Midnight EST.
    const nyUTC = Date.UTC(nyTime.getFullYear(), nyTime.getMonth(), nyTime.getDate());
    const dayIndex = Math.floor(nyUTC / (1000 * 60 * 60 * 24));

    // 3. Math to determine which 5 items to show today, and which 5 for tomorrow
    const startIndex = (dayIndex * catsPerDay) % totalCats;
    const nextIndex = ((dayIndex + 1) * catsPerDay) % totalCats;

    // 4. Populate TODAY'S Live Categories
    for (let i = 0; i < catsPerDay; i++) {
        const cardIndex = (startIndex + i) % totalCats;
        // cloneNode(true) creates a perfect copy of the HTML to drop in the live zone
        activeList.appendChild(allCards[cardIndex].cloneNode(true));
    }

    // 5. Populate TOMORROW'S Upcoming Categories
    for (let i = 0; i < catsPerDay; i++) {
        const cardIndex = (nextIndex + i) % totalCats;
        upcomingList.appendChild(allCards[cardIndex].cloneNode(true));
    }
}
// ==========================================
// 👑 YESTERDAY'S CHAMPIONS
// ==========================================
async function loadYesterdaysWinners() {
    const winnersContainer = document.getElementById('yesterdays-winners-container');
    if (!winnersContainer) return;

    const masterList = document.getElementById('master-list');
    if (!masterList) return;

    // 1. Calculate Yesterday's Rotation Index
    const allCards = Array.from(masterList.querySelectorAll('.cat-card'));
    const totalCats = allCards.length;
    const catsPerDay = 5;

    const nyTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const nyUTC = Date.UTC(nyTime.getFullYear(), nyTime.getMonth(), nyTime.getDate());
    const dayIndex = Math.floor(nyUTC / (1000 * 60 * 60 * 24));

    // Get the start index for yesterday, wrap around safely if needed
    let yesterdayStartIndex = ((dayIndex - 1) * catsPerDay) % totalCats;
    if (yesterdayStartIndex < 0) yesterdayStartIndex += totalCats;

    const yesterdayCategories = [];
    for (let i = 0; i < catsPerDay; i++) {
        const cardIndex = (yesterdayStartIndex + i) % totalCats;
        yesterdayCategories.push(allCards[cardIndex].getAttribute('data-list'));
    }

    // 2. Setup the UI container
    winnersContainer.innerHTML = `
        <h3 class="winners-title">👑 YESTERDAY'S CHAMPIONS 👑</h3>
        <div class="winners-row" id="winners-row"></div>
    `;
    const row = document.getElementById('winners-row');

    // 3. Fetch the top item for each of yesterday's categories
    yesterdayCategories.forEach(async (catName, index) => {
        try {
            const listRef = collection(db, `lists/${catName}/items`);
            const snap = await getDocs(listRef);
            
            let items = [];
            snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
            
            if (items.length > 0) {
                // Sort by highest votes first
                items.sort((a, b) => b.votes - a.votes);
                const winner = items[0];

                const winnerEl = document.createElement('div');
                winnerEl.classList.add('winner-card');
                winnerEl.style.animationDelay = `${index * 0.1}s`; // Staggered pop-in
                
                const safeImage = winner.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(winner.name)}&background=ff0055&color=fff&size=128&bold=true`;
                
                winnerEl.innerHTML = `
                    <div class="winner-pic-wrapper">
                        <div class="winner-crown">👑</div>
                        <img src="${safeImage}" alt="${winner.name}" class="winner-pic" draggable="false" />
                    </div>
                    <p class="winner-name">${winner.name}</p>
                `;
                row.appendChild(winnerEl);
            }
        } catch (err) {
            console.log(`Preload skipped for ${catName}`, err);
        }
    });
}
// ==========================================
// 💥 DOPAMINE ENTRANCE TRIGGER
// ==========================================
function triggerDopamineEntrance() {
    // Play that arcade start sound you already have at the top of your file!
    if (typeof sfxStart !== 'undefined') {
        sfxStart.currentTime = 0;
        sfxStart.play().catch(err => console.log("Audio blocked by browser:", err));
    }

    // Grab all the list items on the battlefield
    const listItems = document.querySelectorAll('.list-item'); 
    
    listItems.forEach((item, index) => {
        // Remove class and force a DOM reflow so the animation can replay if they back out and re-enter
        item.classList.remove('dopamine-entry');
        void item.offsetWidth; 
        
        // Stagger the delay: Item 1 = 0s, Item 2 = 0.06s, Item 3 = 0.12s...
        item.style.animationDelay = `${index * 0.06}s`;
        item.classList.add('dopamine-entry');
    });
}
function startESTTimer() {
    const mainTimerEl = document.getElementById('est-timer');
    const gameTimerEl = document.getElementById('game-est-timer'); // The new one!

    setInterval(() => {
        const nyTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
        const nextMidnight = new Date(nyTime);
        nextMidnight.setHours(24, 0, 0, 0);

        const diff = nextMidnight - nyTime;

        if (diff <= 0) {
            location.reload();
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);

        const timerText = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} UNTIL RESULTS LOCK`;

        // Update both timers if they exist on the page
        if (mainTimerEl) mainTimerEl.innerText = timerText;
        if (gameTimerEl) gameTimerEl.innerText = timerText;
    }, 1000);
}

// 🚀 RUN IT ALL WHEN THE PAGE LOADS
document.addEventListener("DOMContentLoaded", () => {
    setupDailyRotation();
    startESTTimer();
    loadYesterdaysWinners();
});

// --- PRELOAD CACHE ---
const imageCache = new Set();


async function preloadCategoryImages() {
    // Silently fetch images in the background so they are ready instantly
    const categories = ['presidents', 'spiderman', 'fastfood', 'rappers', 'shows'];
    
    categories.forEach(async (cat) => {
        try {
            const snap = await getDocs(collection(db, `lists/${cat}/items`));
            snap.forEach(doc => {
                const url = doc.data().imageUrl;
                if (url && !imageCache.has(url)) {
                    const img = new Image();
                    img.src = url; // Forces the browser to download and cache it
                    imageCache.add(url);
                }
            });
        } catch (err) {
            console.log("Preload skipped for ", cat);
        }
    });
}
// Listen to the global event document
onSnapshot(doc(db, "global", "latest_event"), (docSnap) => {
    if (!docSnap.exists()) return;
    
    const data = docSnap.data();
    const eventString = `${data.winner.toUpperCase()} JUST CRUSHED ${data.loser.toUpperCase()}!`;

    // 1. UPDATE THE MENU SCROLLING TICKER
    // Add the new event to the front of our rolling history
    recentTickerMessages.unshift(eventString);
    
    // Keep only the last 5 events so the text string doesn't get infinitely long
    if (recentTickerMessages.length > 5) recentTickerMessages.pop();
    
    // Format them with bullet points and update the HTML
    const fullTickerText = recentTickerMessages.join(" • ") + " • ";
    if (categoryTickerContent) categoryTickerContent.innerText = fullTickerText;
    if (categoryTickerClone) categoryTickerClone.innerText = fullTickerText;

    // 2. FIRE THE IN-GAME POPUP BANNER
    // Don't fire the massive popup animation on the very first page load
    if (initialTickerLoad) {
        initialTickerLoad = false;
        return;
    }

    // If the event is more than 10 seconds old, ignore the popup (prevents stale alerts on refresh)
    if (Date.now() - data.timestamp > 10000) return;

    // Fire the Game Screen Banner!
    fireGlobalBanner(`🚨 ${eventString} 🚨`);
});

function fireGlobalBanner(message, isCustom = false) {
    // 1. Clear any active timers so the banner doesn't glitch if spammed
    if (window.bannerTimeout) clearTimeout(window.bannerTimeout);
    if (window.fadeTimeout) clearTimeout(window.fadeTimeout);

    // 2. Prep the text and reset the container's visibility
    globalTickerText.innerText = message;
    globalTickerContainer.classList.remove('hidden', 'fade-out-banner');
    
    // Toggle the purple CSS class based on the message type
    if (isCustom) {
        globalTickerContainer.classList.add('purple-theme');
    } else {
        globalTickerContainer.classList.remove('purple-theme');
    }
    
    // 3. Reset the text animation cleanly
    globalTickerText.style.animation = 'none';
    void globalTickerText.offsetWidth; // Trigger reflow
    
    // 4. FASTER SCROLL: Set to 3.5 seconds
    globalTickerText.style.animation = 'rushAcross 3.5s linear forwards';

    // Massive haptic feedback
    if(navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

    // 5. TIMING LOGIC: Wait exactly 3.5s for text to finish, then fade out
    window.bannerTimeout = setTimeout(() => {
        // Trigger the CSS fade out animation
        globalTickerContainer.classList.add('fade-out-banner');
        
        // Wait 0.5s for the fade out to finish, then fully hide it from the DOM
        window.fadeTimeout = setTimeout(() => {
            globalTickerContainer.classList.add('hidden');
            globalTickerContainer.classList.remove('fade-out-banner'); // Clean up for next time
        }, 500); 

    }, 3500); // 3.5 seconds
}
// --- TICKER BUTTON LOGIC ---
let sessionVotes = 0;

function lockTickerButton() {
    const tickerBtn = document.getElementById('open-ticker-btn');
    if(!tickerBtn) return;
    
    tickerBtn.style.filter = "grayscale(100%)";
    tickerBtn.style.opacity = "0.5";
    tickerBtn.style.pointerEvents = "none"; // Disables clicking
    tickerBtn.style.boxShadow = "none"; // Removes the neon glow
    
    // Just a clean lock icon instead of a long broken sentence
    tickerBtn.innerText = "🔒"; 
}

function unlockTickerButton() {
    const tickerBtn = document.getElementById('open-ticker-btn');
    if(!tickerBtn) return;
    
    tickerBtn.style.filter = "none";
    tickerBtn.style.opacity = "1";
    tickerBtn.style.pointerEvents = "auto"; // Enables clicking
    tickerBtn.style.boxShadow = "0 0 15px #ff0044"; // Brings back the neon glow
    
    // Back to the megaphone!
    tickerBtn.innerText = "📣"; 
    
    // "Pop" animation to draw their eye to it
    tickerBtn.style.transform = "scale(1.3)";
    setTimeout(() => {
        tickerBtn.style.transform = "scale(1)";
    }, 250);

    // Juice: Pop sound & Heavy Vibrate
    if (typeof playPopSound === 'function') playPopSound(10);
    if(navigator.vibrate) navigator.vibrate([100, 50, 100]);
}
function playPopSound(multiplier, effectType = 'default') {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    // --- Sound Design Logic ---
    switch(effectType) {
        case 'fire':
            // Fast, aggressive "Sizzle-Pop"
            osc.type = 'triangle'; 
            osc.frequency.setValueAtTime(400 + (multiplier * 10), now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.2, now);
            break;

        case 'toxic':
            // "Liquid/Bubble" - Pitch slides UP instead of down
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(500 + (multiplier * 5), now + 0.15);
            gain.gain.setValueAtTime(0.15, now);
            break;

        case 'shockwave':
            // "Heavy Thud" - Low frequency, high initial punch
            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 0.2);
            gain.gain.setValueAtTime(0.4, now); // Louder for impact
            break;

        case 'comic':
            // "8-Bit Punch" - Square wave sounds like a retro game
            osc.type = 'square';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.1, now); 
            break;

        default:
            // Your original Pop logic
            osc.type = 'sine';
            const baseFreq = multiplier >= 10 ? 800 : (multiplier > 1 ? 500 : 300);
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
    }

    // Standard fast decay (Dopamine "Click" feel)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (effectType === 'shockwave' ? 0.2 : 0.1));
    
    osc.start(now);
    osc.stop(now + (effectType === 'shockwave' ? 0.2 : 0.1));
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
    
    // Stop ambient particles if not on splash screen
    if(screenName !== 'splash') {
        document.getElementById('ambient-particles').classList.add('hidden');
    } else {
        document.getElementById('ambient-particles').classList.remove('hidden');
    }

    // --- NEW TICKER BUTTON VISIBILITY LOGIC ---
    const tickerBtn = document.getElementById('open-ticker-btn');
    if (tickerBtn) {
        if (screenName === 'game') {
            tickerBtn.style.display = 'block'; // Show it on the game screen
            lockTickerButton(); // Force it to be greyed out/locked immediately
            sessionVotes = 0;   // Reset their vote count to 0
        } else {
            tickerBtn.style.display = 'none'; // Hide it everywhere else!
        }
    }
}
// --- Navigation Events ---
document.getElementById('play-btn').addEventListener('click', () => {
  playSound(sfxStart);
    // Add a satisfying click feel even to entry
    if(navigator.vibrate) navigator.vibrate([30, 10, 30]);
    showScreen('category');
    document.getElementById('global-store-btn').style.display = 'flex';
    
    // START PRELOADING WHILE THEY CHOOSE A CATEGORY
    preloadCategoryImages(); 
});

document.getElementById('back-btn').addEventListener('click', () => {
    playSound(sfxMenu); // Snappy UI click
    if (activeListener) activeListener(); // Stop listening to Firebase
    showScreen('category');
    document.getElementById('global-store-btn').style.display = 'flex';
    currentCategory = null;
    rankingList.innerHTML = ''; // Clear DOM
    
    // Relock Ticker
    lockTickerButton();
    sessionVotes = 0;
});
// Category Selection (Using Event Delegation for Cloned Cards)
document.addEventListener('click', (e) => {
    // 1. Check if the user clicked on a cat-card (or any element inside of one)
    const card = e.target.closest('.cat-card');
    
    // 2. If they didn't click a card, OR if they clicked a locked card in tomorrow's list/the vault, ignore the click!
    if (!card || card.closest('#upcoming-list') || card.closest('#master-list')) {
        return;
    }

    // 3. It's a valid live card! Run your original logic:
    playSound(sfxMenu); // Snappy UI click
    currentCategory = card.getAttribute('data-list');
    const name = card.querySelector('.cat-name').innerText;
    currentListTitle.innerText = name;
    showScreen('game');
    loadBattlefield(currentCategory);
    playWooshSound();
    document.getElementById('global-store-btn').style.display = 'none';
});

// --- Game State ---
let currentCategory = null;
let activeListener = null;
let itemsData = {}; 

// Fever Mode State
let comboClicks = 0;
let multiplier = 1;
let comboTimer;
let currentFocusId = null;
let consecutiveClicks = 0;
const FIRE_THRESHOLD = 150; // Clicks required to ignite
let lastOvertakeTime = 0;
const OVERTAKE_COOLDOWN = 5000; // 5 seconds
// Firebase Batching State (Saves free tier)
let pendingVotes = {}; 

// --- Ambient Particle System (Splash Screen Juice) ---
function initAmbientParticles() {
    const container = document.getElementById('ambient-particles');
    for(let i=0; i<30; i++) {
        const p = document.createElement('div');
        p.classList.add('ambient-p');
        // Random size
        const size = Math.random() * 5 + 1;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        // Random position
        p.style.left = `${Math.random() * 100}vw`;
        p.style.bottom = `-10px`;
        // Random duration & delay
        p.style.animationDuration = `${Math.random() * 5 + 5}s`;
        p.style.animationDelay = `${Math.random() * 5}s`;
        container.appendChild(p);
    }
}
initAmbientParticles();

// --- Firebase Realtime Integration ---
function loadBattlefield(categoryName) {
    const listRef = collection(db, `lists/${categoryName}/items`);
    
    // Clear state
    itemsData = {};
    pendingVotes = {};
    comboClicks = 0;
    resetComboUI();

    // --- SOUND LOGIC: 1. Create a memory bank to remember the order ---
    let previousOrder = [];

    // Start live listener
    activeListener = onSnapshot(listRef, (snapshot) => {
        let updatedItems = [];
        snapshot.forEach(doc => {
            updatedItems.push({ id: doc.id, ...doc.data() });
        });
        
        // 1. Sort by votes (descending)
        updatedItems.sort((a, b) => b.votes - a.votes);

        
        // 2. Map rank #1 to the top item's ID so we know who is winning
        if (updatedItems[0]) {
            document.body.setAttribute('data-winner', updatedItems[0].id);
        }

        animateRankReorder(rankingList, () => {
            updatedItems.forEach((item, index) => {
                itemsData[item.id] = item;

                let itemEl = document.getElementById(`item-${item.id}`);
                if (!itemEl) {
                    itemEl = createItemElement(item.id, item.name, item.imageUrl);
                    rankingList.appendChild(itemEl);
                    
                    // --- JUICE: STAGGERED ENTRANCE ANIMATION ---
                    // We use the 'index' to delay each item slightly more than the last
                    itemEl.style.animation = `popInStagger 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards`;
                    itemEl.style.animationDelay = `${index * 0.06}s`; // 60ms gap between each card
                }

                itemEl.style.order = index;
                itemEl.querySelector('.rank-number').innerText = (index + 1);

                // Update this inside loadBattlefield:
                if (index === 0) {
                    itemEl.classList.add('rank-one');
                    itemEl.classList.remove('rank-last');
                    itemEl.style.borderColor = 'transparent';
                } else if (index === updatedItems.length - 1) {
                    // DEAD LAST!
                    itemEl.classList.add('rank-last');
                    itemEl.classList.remove('rank-one');
                    itemEl.style.borderColor = '#444'; // Optional: Give the loser a sad grey border
                } else {
                    itemEl.classList.remove('rank-one', 'rank-last');
                    if (index === 1) itemEl.style.borderColor = '#C0C0C0';
                    else if (index === 2) itemEl.style.borderColor = '#CD7F32';
                    else itemEl.style.borderColor = 'transparent';
                }

                const localBuffer = pendingVotes[item.id] || 0;
                itemEl.querySelector('.item-votes').innerText =
                    (item.votes + localBuffer).toLocaleString() + ' VOTES';
            });
        });
    });
}

// --- Dynamic DOM Creation ---
function createItemElement(id, name, imageUrl) {
    const div = document.createElement('div');
    div.classList.add('list-item');
    div.id = `item-${id}`; 
    
    const safeImage = imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff0055&color=fff&size=128&bold=true`;

    div.innerHTML = `
        <div class="rank-number"></div>
        <div class="item-pic-wrapper">
            <div class="crown-icon">👑</div>
            <div class="trash-icon">🗑️</div>
            
            <img class="item-pic" src="${safeImage}" alt="${name}" draggable="false" />
            <svg class="mash-trace-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46"></circle>
            </svg>
        </div>
        <div class="item-info">
            <h3 class="item-name">${name}</h3>
            <p class="item-votes">0 VOTES</p>
        </div>
        <div class="mash-btn-wrapper">
            <button class="mash-btn">MASH!</button>
        </div>
    `;
    
    const btn = div.querySelector('.mash-btn');
    btn.addEventListener('pointerdown', (e) => {
        handleMash(id, e);
        
        // Bounce the crown (if they have it)
        const crown = div.querySelector('.crown-icon');
        if (crown) {
            crown.classList.remove('vote-bounce');
            void crown.offsetWidth; 
            crown.classList.add('vote-bounce');
        }

        // Bounce the trash (if they have it)
        const trash = div.querySelector('.trash-icon');
        if (trash) {
            trash.classList.remove('vote-bounce');
            void trash.offsetWidth; 
            trash.classList.add('vote-bounce');
        }
    });

    return div;
}
function handleMash(id, e) {
    spawnEffect(e.clientX, e.clientY, equippedEffect, document.body);

    // --- NEW: CALCULATE TOTAL CLICK POWER ---
    // If the 2X boost is active, double whatever their current combo multiplier is.
    // Ensure we default to 1 if `multiplier` isn't defined yet.
    let baseMultiplier = typeof multiplier !== 'undefined' ? multiplier : 1;
    let clickPower = (typeof isDoubleClicksActive !== 'undefined' && isDoubleClicksActive) 
                     ? baseMultiplier * 2 
                     : baseMultiplier;

    // 1. TRACK CONSECUTIVE CLICKS FOR "ON FIRE" MODE
    if (currentFocusId === id) {
        consecutiveClicks++;
    } else {
        // They switched targets! Put out the fire on the old guy.
        if (currentFocusId) {
            const oldEl = document.getElementById(`item-${currentFocusId}`);
            if(oldEl) oldEl.classList.remove('on-fire');
        }
        currentFocusId = id;
        consecutiveClicks = 1;
    }

    const isOnFire = consecutiveClicks >= FIRE_THRESHOLD;
    const itemEl = document.getElementById(`item-${id}`);

    // Just ignited!
    if (consecutiveClicks === FIRE_THRESHOLD) {
        itemEl.classList.add('on-fire');
        if(navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]); // Heavy buzz
    }

    // 2. Combo / Multiplier Calc (Your existing code)
    comboClicks++;
    updateCombo(); // Assuming updateCombo() updates the global `multiplier`
    
    // --- THE ON FIRE SPLASH DAMAGE ---
    if (isOnFire) {
        // Find the person right below them in the rankings
        const sortedItems = Object.values(itemsData).sort((a, b) => b.votes - a.votes);
        const myIndex = sortedItems.findIndex(item => item.id === id);
        
        // If there is someone below us, steal a vote from them!
        if (myIndex >= 0 && myIndex < sortedItems.length - 1) {
            const victimId = sortedItems[myIndex + 1].id;
            
            // Steal votes equivalent to your current click power! (2X steals double!)
            if (!pendingVotes[victimId]) pendingVotes[victimId] = 0;
            pendingVotes[victimId] -= clickPower; 
            
            // Update Victim UI immediately
            const victimBase = itemsData[victimId].votes;
            const victimTotal = victimBase + pendingVotes[victimId];
            const victimVoteDisplay = document.querySelector(`#item-${victimId} .item-votes`);
            if(victimVoteDisplay) victimVoteDisplay.innerText = victimTotal.toLocaleString() + ' VOTES';
            
            // Flash the victim card red
            const victimEl = document.getElementById(`item-${victimId}`);
            if(victimEl) {
                victimEl.classList.add('taking-damage');
                setTimeout(() => victimEl.classList.remove('taking-damage'), 200);
            }
        }
    }

    // --- THE MILESTONE MATH ---
    const currentBase = itemsData[id] ? itemsData[id].votes : 0;
    const oldTotal = currentBase + (pendingVotes[id] || 0); // Score before this click

    // 2. Optimistic UI Update (USE CLICK POWER HERE)
    if (!pendingVotes[id]) pendingVotes[id] = 0;
    pendingVotes[id] += clickPower;
    
    const newTotal = currentBase + pendingVotes[id]; // Score after this click
    
    // --- TICKER UNLOCK LOGIC (USE CLICK POWER HERE) ---
    sessionVotes += clickPower;
    if (sessionVotes >= 100) {
        unlockTickerButton();
        sessionVotes = 0; // Reset counter so they must mash 100 more times for the next message
    }

    // Update display text immediately
    const voteDisplay = document.querySelector(`#item-${id} .item-votes`);
    voteDisplay.innerText = newTotal.toLocaleString() + ' VOTES';

    // --- CHECK FOR MILESTONE NUKE (Every 100 votes) ---
    if (Math.floor(oldTotal / 100) < Math.floor(newTotal / 100)) {
        triggerMilestoneNuke(itemsData[id].name, newTotal);
    }

    // 3. VISUAL JUICE
    // Show the actual points gained (+2, +4, +10, etc.)
    createFloatingText(e.clientX, e.clientY, `+${clickPower}`);
    playPopSound(clickPower, equippedEffect); // Play different sounds based on the effect type and click power

    // --- ULTRA-SMOOTH TRACE ANIMATION (JS-DRIVEN) ---
    const circle = itemEl.querySelector('.mash-trace-svg circle');
    if (circle) {
        // Circumference is ~289 for r=46
        circle.animate([
            { strokeDashoffset: '289', transform: 'scale(0.96)', opacity: 1 },
            { strokeDashoffset: '0', transform: 'scale(1.08)', opacity: 1, offset: 0.6 },
            { strokeDashoffset: '-20', transform: 'scale(1.12)', opacity: 0 }
        ], {
            duration: 350,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
            fill: 'none' // Ensures it disappears and resets automatically
        });
    }

    // --- JUICE: RANK-BASED HIT FLASHES ---
    const cardEl = document.getElementById(`item-${id}`);
    let currentRank = parseInt(cardEl.style.order) || 0;
    let flashClass = 'flash-standard';
    
    if (currentRank === 0) flashClass = 'flash-gold';
    else if (currentRank === 1) flashClass = 'flash-silver';
    else if (currentRank === 2) flashClass = 'flash-bronze';

    // 1. Remove all possible flashes
    cardEl.classList.remove('flash-standard', 'flash-gold', 'flash-silver', 'flash-bronze', 'flash-hit');
    
    // 2. FORCED REFLOW: This strictly commands the browser to restart the CSS animation!
    void cardEl.offsetWidth; 
    
    // 3. Re-apply the flash
    cardEl.classList.add(flashClass);
    
    // Mobile Haptics
    if (navigator.vibrate) {
        if(clickPower >= 10) navigator.vibrate(25);
        else navigator.vibrate(10); 
    }

    // --- SORTING & RANKING LOGIC ---
    let itemsArray = Object.values(itemsData).map(item => ({
        id: item.id,
        name: item.name,
        total: item.votes + (pendingVotes[item.id] || 0)
    })).sort((a, b) => b.total - a.total);

    let newRank = itemsArray.findIndex(i => i.id === id);
    let oldRank = parseInt(cardEl.style.order) || newRank;

    // OPTIMIZATION: Only touch the DOM if a rank ACTUALLY changed
    let ranksShifted = false;
    itemsArray.forEach((item, index) => {
        let el = document.getElementById(`item-${item.id}`);
        if (!el) return;
        
        let currentOrder = parseInt(el.style.order);
        if (currentOrder !== index || isNaN(currentOrder)) {
            el.style.order = index;
            el.querySelector('.rank-number').innerText = (index + 1);
            ranksShifted = true;
        }
        // --- Optimistic Icon Snapping ---
        if (index === 0) {
            el.classList.add('rank-one');
            el.classList.remove('rank-last');
        } else if (index === itemsArray.length - 1) {
            el.classList.add('rank-last');
            el.classList.remove('rank-one');
        } else {
            el.classList.remove('rank-one', 'rank-last');
        }
    });

    // 4. Reset Clash visuals ONLY if something moved
    if (ranksShifted || document.querySelector('.clashing')) {
        document.querySelectorAll('.list-item').forEach(el => el.classList.remove('clashing'));
        rankingList.classList.remove('list-dimmed');
    }

    // 5. DID WE OVERTAKE?
    if (newRank < oldRank) {
        const now = Date.now();
        // Only trigger if enough time has passed since the last one
        if (now - lastOvertakeTime > OVERTAKE_COOLDOWN) {
            let winnerName = itemsData[id].name;
            let loserName = itemsArray[newRank + 1].name;
            
            triggerOvertakeEffect(winnerName, loserName);
            lastOvertakeTime = now; // Reset the cooldown
            
            // Firebase update...
            setDoc(doc(db, "global", "latest_event"), {
                winner: winnerName,
                loser: loserName,
                timestamp: now
            });
        }
    }
    // 6. ARE WE IN A 1v1 CLASH? 
    else if (newRank > 0) {
        let gap = itemsArray[newRank - 1].total - itemsArray[newRank].total;
        if (gap > 0 && gap <= 25) {
            rankingList.classList.add('list-dimmed');
            document.getElementById(`item-${id}`).classList.add('clashing');
            document.getElementById(`item-${itemsArray[newRank - 1].id}`).classList.add('clashing');
        }
    }
}

// --- Firebase Batch Writer (Critical for Free Tier) ---
// Ticks every 2 seconds to send buffered clicks.
setInterval(() => {
    if (!currentCategory) return;
    
    Object.keys(pendingVotes).forEach(itemId => {
        const votesToSend = pendingVotes[itemId];
        if (votesToSend > 0) {
            const itemRef = doc(db, `lists/${currentCategory}/items`, itemId);
            updateDoc(itemRef, {
                votes: increment(votesToSend)
            });
            // Clear local buffer AFTER sending
            pendingVotes[itemId] = 0; 
        }
    });
}, 2000);

// --- Juice: Combo & Fever Mode Logic ---
function updateCombo() {
    clearTimeout(comboTimer);
    
    // 1. The New Ceiling: 150 clicks is now the max for the visual bar
    const MAX_CLICKS = 150;
    let barPercentage = Math.min((comboClicks / MAX_CLICKS) * 100, 100);
    comboBarFill.style.width = `${barPercentage}%`;

    // 2. The Multiplier Tiers (Must be ordered Highest to Lowest)
    if (comboClicks >= 150) {
        // SUPER HARD: Requires sustained aggressive mashing
        multiplier = 10;
        comboText.innerText = "🔥 10x FEVER RIOT! 🔥";
        comboText.style.color = getCssVar('--riot-pink');
        comboBarFill.style.background = getCssVar('--riot-pink');
        body.classList.add('shake', 'fever-pulse');
        
    } else if (comboClicks >= 80) {
        // PRETTY HARD: They are sweating now
        multiplier = 5;
        comboText.innerText = "⚡ 5x UNSTOPPABLE ⚡";
        comboText.style.color = "#ffaa00"; /* Neon Orange */
        comboBarFill.style.background = "#ffaa00";
        body.classList.remove('shake', 'fever-pulse'); // Keep UI clean until the final tier
        
    } else if (comboClicks >= 40) {
        // GETTING WARM: Your old 10x is now just a 3x
        multiplier = 3;
        comboText.innerText = "3x RAMPAGE";
        comboText.style.color = "#b500ff"; /* Neon Purple */
        comboBarFill.style.background = "#b500ff";
        
    } else if (comboClicks >= 15) {
        // FIRST BLOOD
        multiplier = 2;
        comboText.innerText = "2x MULTIPLIER";
        comboText.style.color = getCssVar('--riot-blue');
        comboBarFill.style.background = getCssVar('--riot-blue');
        
    } else {
        // BASE STATE!
        multiplier = 1;
        comboText.innerText = "1x SPAM";
        comboText.style.color = getCssVar('--text'); 
        comboBarFill.style.background = getCssVar('--text'); 
    }

    // Drop combo entirely if they stop clicking for 0.8 seconds
    comboTimer = setTimeout(resetComboUI, 800); 
}

function resetComboUI() {
    comboClicks = 0;
    multiplier = 1;
    comboBarFill.style.width = '0%';
    comboBarFill.style.background = getCssVar('--riot-blue');
    comboText.innerText = "1x SPAM";
    comboText.style.color = getCssVar('--riot-blue');
    body.classList.remove('shake', 'fever-pulse');
}

// --- Juice: Floating Numbers + Rotation ---
function createFloatingText(x, y, text) {
    const floater = document.createElement('div');
    floater.classList.add('floating-number');
    floater.innerText = text;
    
    // Random rotation for chaotic look
    const randRotate = (Math.random() - 0.5) * 40; // -20 to +20 deg
    floater.style.setProperty('--rand-rotate', `${randRotate}deg`);
    
    // Random position offset from finger
    const offsetX = (Math.random() - 0.5) * 70;
    floater.style.left = `${x + offsetX}px`;
    floater.style.top = `${y - 50}px`; // Start above finger
    
    // Color depends on multiplier
    if(multiplier === 10) {
        floater.style.color = getCssVar('--riot-pink');
        floater.style.fontSize = '3.5rem';
    } else if (multiplier === 2) {
        floater.style.color = getCssVar('--riot-blue');
        floater.style.fontSize = '2.8rem';
    } else {
        floater.style.color = 'white';
        floater.style.fontSize = '2rem';
    }

    body.appendChild(floater);
    setTimeout(() => floater.remove(), 600); // Cleanup DOM
}

// Helper to access CSS variables in JS (Renamed to fix reserved keyword error)
function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
// window.seedDatabase = async function() {
//     console.log("🧹 Sweeping ALL databases clean...");

//     // The Master Data Object containing all 5 categories
//     const allCategories = {
        
//         // 1. PRESIDENTS (Preserved your links!)
//         presidents: [
//             { id: "biden", name: "Joe Biden", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Joe_Biden_presidential_portrait_%28cropped%29.jpg" },
//             { id: "trump", name: "Donald Trump", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg" },
//             { id: "obama", name: "Barack Obama", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg" },
//             { id: "bush43", name: "George W. Bush", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/84/George-W-Bush_%28cropped_2%29.jpeg" },
//             { id: "clinton", name: "Bill Clinton", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Bill_Clinton.jpg" },
//             { id: "bush41", name: "George H.W. Bush", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ee/George_H._W._Bush_presidential_portrait_%28cropped%29.jpg" },
//             { id: "reagan", name: "Ronald Reagan", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Official_Portrait_of_President_Reagan_1981.jpg" },
//             { id: "carter", name: "Jimmy Carter", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5a/JimmyCarterPortrait2.jpg" },
//             { id: "ford", name: "Gerald Ford", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Gerald_Ford_presidential_portrait_%28cropped%29.jpg" },
//             { id: "nixon", name: "Richard Nixon", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Richard_Nixon_presidential_portrait.jpg" },
//             { id: "lbj", name: "Lyndon B. Johnson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/37_Lyndon_Johnson_3x4.jpg" },
//             { id: "jfk", name: "John F. Kennedy", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/John_F._Kennedy%2C_White_House_color_photo_portrait.jpg" },
//             { id: "ike", name: "Dwight D. Eisenhower", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/63/Dwight_D._Eisenhower%2C_official_photo_portrait%2C_May_29%2C_1959.jpg" },
//             { id: "truman", name: "Harry S. Truman", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0b/TRUMAN_58-766-06_%28cropped%29.jpg" },
//             { id: "fdr", name: "Franklin D. Roosevelt", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b8/FDR_in_1933.jpg" },
//             { id: "hoover", name: "Herbert Hoover", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/HerbertHoover.jpg" },
//             { id: "coolidge", name: "Calvin Coolidge", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Calvin_Coolidge_cph.3g10777_%28cropped%29.jpg" },
//             { id: "harding", name: "Warren G. Harding", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Warren_G_Harding-Harris_%26_Ewing.jpg" },
//             { id: "wilson", name: "Woodrow Wilson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/53/Thomas_Woodrow_Wilson%2C_Harris_%26_Ewing_bw_photo_portrait%2C_1919.jpg" },
//             { id: "taft", name: "William Howard Taft", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Cabinet_card_of_William_Howard_Taft_by_Pach_Brothers_-_Cropped_to_image.jpg" },
//             { id: "teddy", name: "Theodore Roosevelt", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Theodore_Roosevelt_by_the_Pach_Bros.jpg" },
//             { id: "mckinley", name: "William McKinley", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f6/William_mckinley.jpg" },
//             { id: "cleveland", name: "Grover Cleveland", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Grover_Cleveland_-_NARA_-_518139_%28cropped%29.jpg" },
//             { id: "harrison_b", name: "Benjamin Harrison", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Pach_Brothers_-_Benjamin_Harrison.jpg" },
//             { id: "arthur", name: "Chester A. Arthur", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/79/Chester_Alan_Arthur.jpg" },
//             { id: "garfield", name: "James A. Garfield", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1f/James_Abram_Garfield%2C_photo_portrait_seated.jpg" },
//             { id: "hayes", name: "Rutherford B. Hayes", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/President_Rutherford_Hayes_1870_-_1880_Restored.jpg" },
//             { id: "grant", name: "Ulysses S. Grant", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/75/Ulysses_S_Grant_by_Brady_c1870-restored.jpg" },
//             { id: "johnson_a", name: "Andrew Johnson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ce/President_Andrew_Johnson.jpg" },
//             { id: "lincoln", name: "Abraham Lincoln", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Abraham_Lincoln_O-77_matte_collodion_print.jpg" },
//             { id: "buchanan", name: "James Buchanan", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fd/James_Buchanan.jpg" },
//             { id: "pierce", name: "Franklin Pierce", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/29/Franklin_Pierce.jpg" },
//             { id: "fillmore", name: "Millard Fillmore", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Millard_Fillmore.jpg" },
//             { id: "taylor", name: "Zachary Taylor", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/51/Zachary_Taylor_restored_and_cropped.jpg" },
//             { id: "polk", name: "James K. Polk", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/JKP.jpg" },
//             { id: "tyler", name: "John Tyler", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/John_Tyler%2C_Jr.jpg" },
//             { id: "harrison_w", name: "William Henry Harrison", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/William_Henry_Harrison_daguerreotype_edit.jpg" },
//             { id: "vanburen", name: "Martin Van Buren", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/94/Martin_Van_Buren_edit.jpg" },
//             { id: "jackson", name: "Andrew Jackson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/43/Andrew_jackson_head.jpg" },
//             { id: "adams_jq", name: "John Quincy Adams", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/John_Q._Adams-edit.jpg" },
//             { id: "monroe", name: "James Monroe", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/James_Monroe_White_House_portrait_1819.jpg" },
//             { id: "madison", name: "James Madison", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/James_Madison.jpg" },
//             { id: "jefferson", name: "Thomas Jefferson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/07/Official_Presidential_portrait_of_Thomas_Jefferson_%28by_Rembrandt_Peale%2C_1800%29.jpg" },
//             { id: "adams_j", name: "John Adams", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Gilbert_Stuart%2C_John_Adams%2C_c._1800-1815%2C_NGA_42933.jpg" },
//             { id: "washington", name: "George Washington", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg" }
//         ],

//         // 2. SPIDER-MAN MOVIES
//         spiderman: [
//             { id: "sm_2002", name: "Spider-Man (2002)", votes: 0, imageUrl: "https://m.media-amazon.com/images/M/MV5BMmNhMjY4MGYtYjBkMC00NjMxLThmNmUtMGZjNGY1MWRmNDU0XkEyXkFqcGc@._V1_.jpg" },
//             { id: "sm_2", name: "Spider-Man 2", votes: 0, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.qUTI37l9u4W0Is3IeKwNtAHaJQ?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "sm_3", name: "Spider-Man 3", votes: 0, imageUrl: "https://tse2.mm.bing.net/th/id/OIP.i1Fu2RdGB7CsAzueetWUdQHaKm?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "asm_1", name: "The Amazing Spider-Man", votes: 0, imageUrl: "https://pics.filmaffinity.com/the_amazing_spider_man_the_amazing_spiderman-672391099-large.jpg" },
//             { id: "asm_2", name: "The Amazing Spider-Man 2", votes: 0, imageUrl: "https://www.scannain.com/media/the-amazing-spider-man-2_intl-poster2.jpg" },
//             { id: "hc", name: "Spider-Man: Homecoming", votes: 0, imageUrl: "https://tse2.mm.bing.net/th/id/OIP.zGSI702QZFgb8-X_eTjO5AHaLH?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "ffh", name: "Spider-Man: Far From Home", votes: 0, imageUrl: "https://tse1.mm.bing.net/th/id/OIP.i1aIGenvmekZMMrQKu1zywHaLH?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "nwh", name: "Spider-Man: No Way Home", votes: 0, imageUrl: "https://tse4.mm.bing.net/th/id/OIP.tHX3xsb4XLGRJ5FzC9IZdQHaK-?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "sv_1", name: "Into the Spider-Verse", votes: 0, imageUrl: "https://image.tmdb.org/t/p/w1280/9LuL3pwJiwIWSckeCbOX8G12F4X.jpg" },
//             { id: "sv_2", name: "Across the Spider-Verse", votes: 0, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.HGuuJ_JlSJFz8aOT7TOyxwHaK-?rs=1&pid=ImgDetMain&o=7&rm=3" }
//         ],

//         // 3. FAST FOOD KINGS
//         fastfood: [
//             { id: "mcd", name: "McDonald's", votes: 0, imageUrl: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/ccfca04c-6fa9-4a68-9bc7-134bfd5c5650/dfr1edm-c2d05053-3179-4879-8d34-95c7608303bd.jpg/v1/fill/w_1280,h_896,q_75,strp/mcdonald_s_logo_by_fanta_shokata_by_fantaschokata_dfr1edm-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9ODk2IiwicGF0aCI6IlwvZlwvY2NmY2EwNGMtNmZhOS00YTY4LTliYzctMTM0YmZkNWM1NjUwXC9kZnIxZWRtLWMyZDA1MDUzLTMxNzktNDg3OS04ZDM0LTk1Yzc2MDgzMDNiZC5qcGciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.d74AGaqdDxXMFPLEIs7Wd9Y_jxCtSbl0rveC4_T7Ksk" },
//             { id: "wendys", name: "Wendy's", votes: 0, imageUrl: "https://www.pngmart.com/files/23/Wendys-Logo-PNG-HD.png" },
//             { id: "bk", name: "Burger King", votes: 0, imageUrl: "https://purepng.com/public/uploads/large/burger-king-logo-xua.png" },
//             { id: "taco", name: "Taco Bell", votes: 0, imageUrl: "https://th.bing.com/th/id/R.a89f9d0d9872aa99f8f34b43de91f39d?rik=xSaqvW5ijS1eXA&riu=http%3a%2f%2fcdn.mos.cms.futurecdn.net%2fhgRu36yguybcDeZLsZybEA.jpg&ehk=tQSZ%2fd8i6qFyinJIuEyhXDjtXvswJubOQAcDLc4zNg4%3d&risl=&pid=ImgRaw&r=0" },
//             { id: "kfc", name: "KFC", votes: 0, imageUrl: "https://1000logos.net/wp-content/uploads/2019/07/KFC-logo-2018.jpg" },
//             { id: "popeyes", name: "Popeyes", votes: 0, imageUrl: "https://tse2.mm.bing.net/th/id/OIP.ymQ8vpITAK9aKzf1WifpsAHaHZ?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "cfa", name: "Chick-fil-A", votes: 0, imageUrl: "https://mma.prnewswire.com/media/181277/chick_fil_a__inc__logo.jpg?p=facebook" },
//             { id: "chipotle", name: "Chipotle", votes: 0, imageUrl: "https://tse1.mm.bing.net/th/id/OIP.UNfUqpvG8mksXexVBjt6owHaHa?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "subway", name: "Subway", votes: 0, imageUrl: "https://logos-world.net/wp-content/uploads/2023/01/Subway-Emblem.png" },
//             { id: "innout", name: "In-N-Out Burger", votes: 0, imageUrl: "https://th.bing.com/th/id/R.ec8e1f17505126f1b5c79bf6c3269fb5?rik=Vist%2fnci1K0J6w&pid=ImgRaw&r=0" },
//             { id: "sonic", name: "Sonic Drive-In", votes: 0, imageUrl: "https://logodix.com/logo/889388.jpg" },
//             { id: "arbys", name: "Arby's", votes: 0, imageUrl: "https://blog.logomyway.com/wp-content/uploads/2021/07/arbys-logo-PNG-1536x1286.jpg" }
//         ],

//         // 4. GOAT RAPPERS
//         rappers: [
//             { id: "kendrick", name: "Kendrick Lamar", votes: 0, imageUrl: "https://allaboutginger.com/wp-content/uploads/2024/05/Untitled-design-1.png" },
//             { id: "drake", name: "Drake", votes: 0, imageUrl: "https://static01.nyt.com/images/2021/12/08/arts/06drake2/06drake2-mediumSquareAt3X.jpg" },
//             { id: "cole", name: "J. Cole", votes: 0, imageUrl: "https://media.gq.com/photos/63c8d5a6cd63aa9138b13c7b/16:9/w_2560%2Cc_limit/1246142881" },
//             { id: "eminem", name: "Eminem", votes: 0, imageUrl: "https://facts.net/wp-content/uploads/2023/07/31-facts-about-eminem-1690006118.jpg" },
//             { id: "jayz", name: "Jay-Z", votes: 0, imageUrl: "https://media.cnn.com/api/v1/images/stellar/prod/gettyimages-1911124317.jpg?c=16x9&q=h_833,w_1480,c_fill" },
//             { id: "nas", name: "Nas", votes: 0, imageUrl: "https://m.media-amazon.com/images/M/MV5BMjExNTE1OTA0Nl5BMl5BanBnXkFtZTcwMTkwNTk0Mg@@._V1_FMjpg_UX1000_.jpg" },
//             { id: "tupac", name: "Tupac Shakur", votes: 0, imageUrl: "https://cdn.britannica.com/02/162002-050-02512608/Tupac-Shakur-1993.jpg" },
//             { id: "biggie", name: "The Notorious B.I.G.", votes: 0, imageUrl: "https://th.bing.com/th/id/R.885804c59fec76a7f145392c17c5deb9?rik=l82okCvFg%2b6Q4Q&pid=ImgRaw&r=0" },
//             { id: "kanye", name: "Kanye West", votes: 0, imageUrl: "https://tse1.mm.bing.net/th/id/OIP.4Pe3JEf8UcfLALZG6GFsEQHaHZ?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "wayne", name: "Lil Wayne", votes: 0, imageUrl: "https://tse1.explicit.bing.net/th/id/OIP.DO4LyJC8Dy3Y-7TKLrE_IQHaHa?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "snoop", name: "Snoop Dogg", votes: 0, imageUrl: "https://static.independent.co.uk/2022/02/08/15/Super_Bowl_Snoop_Dogg_23045.jpg?quality=75&width=1200&auto=webp" },
//             { id: "nicki", name: "Nicki Minaj", votes: 0, imageUrl: "https://www.shefinds.com/files/2023/11/Nicki-Minaj-pink-hair-VMA.jpg" }
//         ],

//         // 5. ELITE TV SHOWS
//         shows: [
//             { id: "bb", name: "Breaking Bad", votes: 0, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.e4JnjmBipimGbevR21juBAHaHa?rs=1&pid=ImgDetMain&o=7&rm=3" },
//             { id: "got", name: "Game of Thrones", votes: 0, imageUrl: "https://www.estrelando.com.br/uploads/2021/04/08/game-of-throne-trailer-1617908969.jpg" },
//             { id: "office", name: "The Office", votes: 0, imageUrl: "https://static1.srcdn.com/wordpress/wp-content/uploads/2023/03/the-office-poster-michael-scott.jpg" },
//             { id: "sopranos", name: "The Sopranos", votes: 0, imageUrl: "https://images-na.ssl-images-amazon.com/images/S/pv-target-images/80aebebe092e4a10b239e96d85f79e50d8d9bf0212c674b4a6fc85b58e7e309e._RI_TTW_.jpg" },
//             { id: "wire", name: "The Wire", votes: 0, imageUrl: "https://m.media-amazon.com/images/S/pv-target-images/513ff06af1d1f20148f2cd42ad5a373bb984799c059a0c5060bb6f888ecb257b.jpg" },
//             { id: "stranger", name: "Stranger Things", votes: 0, imageUrl: "https://th.bing.com/th/id/R.a4d953164c6d3c3f174cac35deaa8d25?rik=IfEQFIpC36Zx0w&riu=http%3a%2f%2fwww.slashfilm.com%2fwp%2fwp-content%2fimages%2fstranger-things-1.jpg&ehk=4Ze%2bL3r5gM%2b7GgdQywfHdjFI%2fUJPBMgU6fBiFVFUwwo%3d&risl=1&pid=ImgRaw&r=0" },
//             { id: "succession", name: "Succession", votes: 0, imageUrl: "https://www.comingsoon.net/wp-content/uploads/sites/3/2023/03/FrrYXjLaAAA_604.jpeg?w=819" },
//             { id: "friends", name: "Friends", votes: 0, imageUrl: "https://m.media-amazon.com/images/S/pv-target-images/c7fc75a423fc33698265a27fe446a41026f3c8642fd6c8706c43b897d2ffb3e6.jpg" },
//             { id: "avatar", name: "Avatar: The Last Airbender", votes: 0, imageUrl: "https://media.themoviedb.org/t/p/w780/kU98MbVVgi72wzceyrEbClZmMFe.jpg" },
//             { id: "bcs", name: "Better Call Saul", votes: 0, imageUrl: "https://cdn.firstcuriosity.com/wp-content/uploads/2025/07/14195356/Better-Call-Saul.jpg" },
//             { id: "seinfeld", name: "Seinfeld", votes: 0, imageUrl: "https://cdn.britannica.com/09/189409-050-01172C19/Cast-Jason-Alexander-Seinfeld-Michael-Richards.jpg" }
//         ],
//         // 1. CANDY BARS
//          "candy_bars": [
//         {
//             "id": "cb_snickers",
//             "name": "Snickers",
//             "votes": 0,
//             "imageUrl": "https://www.snickers.com/cdn-cgi/image/width=600,height=600,f=auto,quality=90/sites/g/files/fnmzdf616/files/migrate-product-files/dryeqrv2efldaaoyceat.png"
//         },
//         {
//             "id": "cb_twix",
//             "name": "Twix",
//             "votes": 0,
//             "imageUrl": "https://www.twix.com/sites/g/files/fnmzdf236/files/migrate-product-files/pm57alsea7mspqhhgfuf.png"
//         },
//         {
//             "id": "cb_kitkat",
//             "name": "Kit Kat",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Kit-Kat-Chocolate-Frosted-Donut-Flavored-King-Size-Candy-Bar-3-oz_8c585231-409f-41d5-aabe-29fa57677cd8.a30f4f0263ffb86cc4f05e107accf279.jpeg?odnHeight=768&odnWidth=768&odnBg=FFFFFF"
//         },
//         {
//             "id": "cb_reeses",
//             "name": "Reese's Cups",
//             "votes": 0,
//             "imageUrl": "https://target.scene7.com/is/image/Target/GUEST_3d53d55f-796b-4c75-85da-d85de17f2f3e"
//         },
//         {
//             "id": "cb_milkyway",
//             "name": "Milky Way",
//             "votes": 0,
//             "imageUrl": "https://cdnimg.webstaurantstore.com/images/products/large/688495/2384408.jpg"
//         },
//         {
//             "id": "cb_butterfinger",
//             "name": "Butterfinger",
//             "votes": 0,
//             "imageUrl": "http://candyfunhouse.com/cdn/shop/products/Candyfunhouse_ferrero_Butterfinger_53-Side-jpg-1.jpg?v=1679971113"
//         },
//         {
//             "id": "cb_hersheys",
//             "name": "Hershey's Bar",
//             "votes": 0,
//             "imageUrl": "https://s7d2.scene7.com/is/image/hersheysassets/0_34000_00240_5_701_24000_097_Item_Front?fmt=webp-alpha&hei=908&qlt=75"
//         },
//         {
//             "id": "cb_crunch",
//             "name": "Crunch Bar",
//             "votes": 0,
//             "imageUrl": "https://allcitycandy.com/cdn/shop/files/crunch.png?v=1739163400"
//         },
//         {
//             "id": "cb_almondjoy",
//             "name": "Almond Joy",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/61GgXAiFn-L._AC_UF894,1000_QL80_.jpg"
//         },
//         {
//             "id": "cb_snkrs_pb",
//             "name": "Snickers Peanut Butter",
//             "votes": 0,
//             "imageUrl": "https://candyfunhouse.com/cdn/shop/files/Candyfunhouse_Mars_snickersPeanutbutter_50-Top-jpg-1.jpg?v=1697219888&width=1200"
//         }
//     ],
//     "gaming_consoles": [
//         {
//             "id": "gc_ps5",
//             "name": "PlayStation 5",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Sony-PlayStation-5-Video-Game-Console_707bdc7d-fe56-4cf9-8c4d-2040b311cb05.66ded98227daca189a07c7b0892799b8.jpeg?odnHeight=768&odnWidth=768&odnBg=FFFFFF"
//         },
//         {
//             "id": "gc_xbox360",
//             "name": "Xbox 360",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/61oFqsoj9nL._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "gc_n64",
//             "name": "Nintendo 64",
//             "votes": 0,
//             "imageUrl": "https://i.ebayimg.com/images/g/SpEAAOSwjBdlyUqs/s-l1200.png"
//         },
//         {
//             "id": "gc_snes",
//             "name": "Super Nintendo",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/61WyNYECFYL.jpg"
//         },
//         {
//             "id": "gc_ps4",
//             "name": "PlayStation 4",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/51t0bPwu8uL.jpg"
//         },
//         {
//             "id": "gc_switch",
//             "name": "Nintendo Switch",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/51YXZgm0DbL.jpg"
//         },
//         {
//             "id": "gc_wii",
//             "name": "Nintendo Wii",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/51kWf+zxkwL.jpg"
//         },
//         {
//             "id": "gc_gamecube",
//             "name": "GameCube",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/51s+fOXzUbL.jpg"
//         },
//         {
//             "id": "gc_ps1",
//             "name": "PlayStation 1",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/51H7anEOy3L.jpg"
//         },
//         {
//             "id": "gc_xbox",
//             "name": "Original Xbox",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/71AtLTRlT2L.jpg"
//         }
//     ],
//     "cereals": [
//         {
//             "id": "cer_cinnamon",
//             "name": "Cinnamon Toast Crunch",
//             "votes": 0,
//             "imageUrl": "https://www.cinnamontoastcrunch.com/_next/image?url=https%3A%2F%2Fprodcontent.cinnamontoastcrunch.com%2Fwp-content%2Fuploads%2F2024%2F05%2Fctc-products-page-mobile-hero-770x514px.jpg&w=1400&q=75"
//         },
//         {
//             "id": "cer_frosted",
//             "name": "Frosted Flakes",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Kellogg-s-Breakfast-Cereal-Frosted-Flakes-Original-26-8-Oz_81f5dc77-6a62-4933-bfc4-84ba407bd794_2.fa00c9782df1cbadf823b651f9e9c9b7.jpeg"
//         },
//         {
//             "id": "cer_capn",
//             "name": "Cap'n Crunch",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81pQ91RAWyL.jpg"
//         },
//         {
//             "id": "cer_froot",
//             "name": "Froot Loops",
//             "votes": 0,
//             "imageUrl": "https://cdnimg.webstaurantstore.com/images/products/large/690163/2375193.jpg"
//         },
//         {
//             "id": "cer_luckycharms",
//             "name": "Lucky Charms",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81mebmVMDXL._AC_UF894,1000_QL80_.jpg"
//         },
//         {
//             "id": "cer_reeses",
//             "name": "Reese's Puffs",
//             "votes": 0,
//             "imageUrl": "https://target.scene7.com/is/image/Target/GUEST_e66ecf30-8dca-4838-8dfc-29c1916ebb62"
//         },
//         {
//             "id": "cer_applejacks",
//             "name": "Apple Jacks",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/91awApI3OsL.jpg"
//         },
//         {
//             "id": "cer_krave",
//             "name": "Krave",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81U7EHhsIyL.jpg"
//         },
//         {
//             "id": "cer_honey",
//             "name": "Honey Nut Cheerios",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81nWi4mIr8L._AC_UF894,1000_QL80_.jpg"
//         },
//         {
//             "id": "cer_fruity",
//             "name": "Fruity Pebbles",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81jhOSkgJRL._AC_UF350,350_QL80_.jpg"
//         }
//     ],
//     "sodas": [
//         {
//             "id": "sd_coke",
//             "name": "Coca-Cola",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/71rHcpUCigL._AC_UF894,1000_QL80_.jpg"
//         },
//         {
//             "id": "sd_pepsi",
//             "name": "Pepsi",
//             "votes": 0,
//             "imageUrl": "https://pepsi-florence.com/wp-content/uploads/2025/08/PepsiFlorence_Bottle-LineUp-1024x410.jpg"
//         },
//         {
//             "id": "sd_drpepper",
//             "name": "Dr Pepper",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81y7OsLt3EL.jpg"
//         },
//         {
//             "id": "sd_sprite",
//             "name": "Sprite",
//             "votes": 0,
//             "imageUrl": "https://beverages2u.com/wp-content/uploads/2022/09/BCF7081A-3889-4B05-9F90-1158F3272C99.png"
//         },
//         {
//             "id": "sd_mtndew",
//             "name": "Mountain Dew",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/813SRq3wbtL.jpg"
//         },
//         {
//             "id": "sd_fanta",
//             "name": "Fanta",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/71jhlLCVwIS.jpg"
//         },
//         {
//             "id": "sd_rootbeer",
//             "name": "A&W Root Beer",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/A-W-Root-Beer-Soda-Pop-12oz-Cans-Quantity-of-36_6cc02809-1db9-4531-ab00-8be1fc0812d6.9a9959d24aa5da47dc0d79ff3bfad67e.jpeg?odnHeight=768&odnWidth=768&odnBg=FFFFFF"
//         },
//         {
//             "id": "sd_7up",
//             "name": "7UP",
//             "votes": 0,
//             "imageUrl": "https://beverages2u.com/wp-content/uploads/2019/05/0007800000038_C.jpg"
//         },
//         {
//             "id": "sd_canadadry",
//             "name": "Canada Dry Ginger Ale",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Canada-Dry-Ginger-Ale-Soda-12oz-Cans-Quantity-of-36_74e3f5cd-f5d7-4153-8b4a-96a07b75297e.b8f1a08a710b2f27be55a6cc48440e5e.jpeg"
//         },
//         {
//             "id": "sd_mug",
//             "name": "Mug Root Beer",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/812lssm-UvL.jpg"
//         }
//     ],
//     "pizza_toppings": [
//         {
//             "id": "pz_pepperoni",
//             "name": "Pepperoni",
//             "votes": 0,
//             "imageUrl": "https://lifemadesimplebakes.com/wp-content/uploads/2020/10/Classic-Pepperoni-Pizza-square-1200.jpg"
//         },
//         {
//             "id": "pz_sausage",
//             "name": "Sausage",
//             "votes": 0,
//             "imageUrl": "https://cookingwithcarbs.com/wp-content/uploads/2021/06/spicy-sausage-pizza-final8-min.jpg"
//         },
//         {
//             "id": "pz_mushrooms",
//             "name": "Mushrooms",
//             "votes": 0,
//             "imageUrl": "https://www.acouplecooks.com/wp-content/uploads/2019/06/Mushroom-Pizza-with-Herbs-011.jpg"
//         },
//         {
//             "id": "pz_onions",
//             "name": "Onions",
//             "votes": 0,
//             "imageUrl": "https://cozycravings.com/wp-content/uploads/2024/03/DSC_5880-2.jpg"
//         },
//         {
//             "id": "pz_bacon",
//             "name": "Bacon",
//             "votes": 0,
//             "imageUrl": "https://www.thespruceeats.com/thmb/23NTwSODwjvMBSuc87GILHxD8t4=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/bacon-pizza-482053-hero-01-2f6c8ac218e54d16968e0dd8378cc1d4.jpg"
//         },
//         {
//             "id": "pz_extrac cheese",
//             "name": "Extra Cheese",
//             "votes": 0,
//             "imageUrl": "https://www.inspiredtaste.net/wp-content/uploads/2023/08/Cheese-Pizza-2-1200.jpg"
//         },
//         {
//             "id": "pz_blackolives",
//             "name": "Black Olives",
//             "votes": 0,
//             "imageUrl": "https://howtofeedaloon.com/wp-content/uploads/2018/04/pizza-IG.jpg"
//         },
//         {
//             "id": "pz_greenpeppers",
//             "name": "Green Peppers",
//             "votes": 0,
//             "imageUrl": "https://images.squarespace-cdn.com/content/v1/63a2ceeac0b9e71a0264438e/350ee387-5c95-4607-9d3d-b40dfc094377/IMG_2545.jpeg"
//         },
//         {
//             "id": "pz_pineapple",
//             "name": "Pineapple!",
//             "votes": 0,
//             "imageUrl": "https://www.withspice.com/wp-content/uploads/2022/03/hawaiian-pizza-recipe-with-caramelized-pineapple-prosciutto-and-bacon.jpg"
//         },
//         {
//             "id": "pz_jalapenos",
//             "name": "Jalapeños",
//             "votes": 0,
//             "imageUrl": "https://www.allrecipes.com/thmb/Y_s2ecSvUt411wbfdFXwMhg9nEg=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/1095748-a325afbebed84e45bfb171fb5f5014cf.jpg"
//         }
//     ],
//     "ice_cream": [
//         {
//             "id": "ic_vanilla",
//             "name": "Vanilla",
//             "votes": 0,
//             "imageUrl": "https://www.simplysated.com/wp-content/uploads/2014/08/Homemade-Vanilla-Ice-Cream-22-1-P7270022.jpg"
//         },
//         {
//             "id": "ic_chocolate",
//             "name": "Chocolate",
//             "votes": 0,
//             "imageUrl": "https://saltandbaker.com/wp-content/uploads/2024/04/german-chocolate-ice-cream-recipe-500x500.jpg"
//         },
//         {
//             "id": "ic_strawberry",
//             "name": "Strawberry",
//             "votes": 0,
//             "imageUrl": "https://www.chewoutloud.com/wp-content/uploads/2024/04/Strawberry-Ice-Cream-in-Bowl.jpg"
//         },
//         {
//             "id": "ic_mintcc",
//             "name": "Mint Chocolate Chip",
//             "votes": 0,
//             "imageUrl": "https://www.simplystacie.net/wp-content/uploads/2018/06/Mint-Chocolate-Chip-Ice-Cream-LOW-RES-33.jpg"
//         },
//         {
//             "id": "ic_cookiedough",
//             "name": "Cookie Dough",
//             "votes": 0,
//             "imageUrl": "https://celebratingsweets.com/wp-content/uploads/2023/04/Cookie-Dough-Ice-Cream-9.jpg"
//         },
//         {
//             "id": "ic_cookiesncream",
//             "name": "Cookies 'n Cream",
//             "votes": 0,
//             "imageUrl": "https://cdn.aboutamom.com/uploads/2024/12/a-cookies_and_cream_ice_cream_recipe-feature-1.jpeg"
//         },
//         {
//             "id": "ic_rockyroad",
//             "name": "Rocky Road",
//             "votes": 0,
//             "imageUrl": "https://lmld.org/wp-content/uploads/2022/06/Rocky-Road-Ice-Cream-14.jpg"
//         },
//         {
//             "id": "ic_pistachio",
//             "name": "Pistachio",
//             "votes": 0,
//             "imageUrl": "https://images.getrecipekit.com/20250508091729-pistachio-20ice-20cream-20with-20chocolate-20drizzle.png?aspect_ratio=4:3&quality=90&"
//         },
//         {
//             "id": "ic_coffee",
//             "name": "Coffee",
//             "votes": 0,
//             "imageUrl": "https://www.thehungrybites.com/wp-content/uploads/2023/05/easy-coffee-ice-cream-featured.jpg"
//         },
//         {
//             "id": "ic_butterpecan",
//             "name": "Butter Pecan",
//             "votes": 0,
//             "imageUrl": "https://www.incredibleegg.org/wp-content/uploads/2024/07/m-butter-pecan-ice-cream.jpg"
//         }
//     ],
//     "pixar_movies": [
//         {
//             "id": "px_toystory",
//             "name": "Toy Story",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/1/13/Toy_Story.jpg"
//         },
//         {
//             "id": "px_incredibles",
//             "name": "The Incredibles",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMTY5OTU0OTc2NV5BMl5BanBnXkFtZTcwMzU4MDcyMQ@@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "px_nemo",
//             "name": "Finding Nemo",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/2/29/Finding_Nemo.jpg"
//         },
//         {
//             "id": "px_monsters",
//             "name": "Monsters, Inc.",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/6/63/Monsters_Inc.JPG"
//         },
//         {
//             "id": "px_wall_e",
//             "name": "WALL-E",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMjExMTg5OTU0NF5BMl5BanBnXkFtZTcwMjMxMzMzMw@@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "px_up",
//             "name": "Up",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/0/05/Up_%282009_film%29.jpg"
//         },
//         {
//             "id": "px_ratatouille",
//             "name": "Ratatouille",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/5/50/RatatouillePoster.jpg"
//         },
//         {
//             "id": "px_insideout",
//             "name": "Inside Out",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOTgxMDQwMDk0OF5BMl5BanBnXkFtZTgwNjU5OTg2NDE@._V1_.jpg"
//         },
//         {
//             "id": "px_cars",
//             "name": "Cars",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/3/34/Cars_2006.jpg"
//         },
//         {
//             "id": "px_coco",
//             "name": "Coco",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMDIyM2E2NTAtMzlhNy00ZGUxLWI1NjgtZDY5MzhiMDc5NGU3XkEyXkFqcGc@._V1_.jpg"
//         }
//     ],
//     "batman_actors": [
//         {
//             "id": "bm_conroy",
//             "name": "Kevin Conroy (Voice)",
//             "votes": 0,
//             "imageUrl": "https://variety.com/wp-content/uploads/2022/11/KEvin-Controy-2.jpg?w=1000&h=562&crop=1"
//         },
//         {
//             "id": "bm_bale",
//             "name": "Christian Bale",
//             "votes": 0,
//             "imageUrl": "https://variety.com/wp-content/uploads/2022/07/MCDDAKN_EC004.jpg"
//         },
//         {
//             "id": "bm_keaton",
//             "name": "Michael Keaton",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/8/8a/Bruce_Wayne_%28Michael_Keaton%29.jpg"
//         },
//         {
//             "id": "bm_pattinson",
//             "name": "Robert Pattinson",
//             "votes": 0,
//             "imageUrl": "https://people.com/thmb/GaUPX27JC5RL6NgK9Gy6n-_uWtY=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc():focal(737x201:739x203)/robert-pattinson-030625-6bcb0136be3345c19c6beb74bdba7acf.jpg"
//         },
//         {
//             "id": "bm_affleck",
//             "name": "Ben Affleck",
//             "votes": 0,
//             "imageUrl": "http://esq.h-cdn.co/assets/16/40/640x640/square-1475591443-ben-affleck-batman.jpeg"
//         },
//         {
//             "id": "bm_west",
//             "name": "Adam West",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Adam_West_1961.JPG"
//         },
//         {
//             "id": "bm_kilmer",
//             "name": "Val Kilmer",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/9/9d/Batman_Forever_poster.png"
//         },
//         {
//             "id": "bm_clooney",
//             "name": "George Clooney",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BYzU3ZjE3M2UtM2E4Ni00MDI5LTkyZGUtOTFkMGIyYjNjZGU3XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         }
//     ],
//     "star_wars": [
//         {
//             "id": "sw_newhope",
//             "name": "A New Hope (IV)",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81CIXJxQ3TL._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "sw_empire",
//             "name": "Empire Strikes Back (V)",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMTkxNGFlNDktZmJkNC00MDdhLTg0MTEtZjZiYWI3MGE5NWIwXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sw_jedi",
//             "name": "Return of the Jedi (VI)",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/b/b2/ReturnOfTheJediPoster1983.jpg"
//         },
//         {
//             "id": "sw_phantom",
//             "name": "The Phantom Menace (I)",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BODVhNGIxOGItYWNlMi00YTA0LWI3NTctZmQxZGUwZDEyZWI4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "sw_clones",
//             "name": "Attack of the Clones (II)",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BNTgxMjY2YzUtZmVmNC00YjAwLWJlODMtNDBhNzllNzIzMjgxXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sw_sith",
//             "name": "Revenge of the Sith (III)",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BNTc4MTc3NTQ5OF5BMl5BanBnXkFtZTcwOTg0NjI4NA@@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "sw_awakens",
//             "name": "The Force Awakens (VII)",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/a/a2/Star_Wars_The_Force_Awakens_Theatrical_Poster.jpg"
//         },
//         {
//             "id": "sw_rogue",
//             "name": "Rogue One",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d4/Rogue_One%2C_A_Star_Wars_Story_poster.png/250px-Rogue_One%2C_A_Star_Wars_Story_poster.png"
//         }
//     ],
//     "social_media": [
//         {
//             "id": "sm_tiktok",
//             "name": "TikTok",
//             "votes": 0,
//             "imageUrl": "https://redmondmag.com/-/media/ECG/redmondmag/Images/introimages/0803red_tiktok.jpg"
//         },
//         {
//             "id": "sm_insta",
//             "name": "Instagram",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/9/95/Instagram_logo_2022.svg"
//         },
//         {
//             "id": "sm_youtube",
//             "name": "YouTube",
//             "votes": 0,
//             "imageUrl": "https://storage.loopo.org/liKaSgxAwmzzykAjRpMlfuEZYcLsTngBR3u3J2.webp"
//         },
//         {
//             "id": "sm_twitter",
//             "name": "Twitter (X)",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/0/09/X_%28formerly_Twitter%29_logo_late_2025.svg"
//         },
//         {
//             "id": "sm_snapchat",
//             "name": "Snapchat",
//             "votes": 0,
//             "imageUrl": "https://www.willistonian.org/wp-content/uploads/2015/12/Snapchat-IR.png"
//         },
//         {
//             "id": "sm_reddit",
//             "name": "Reddit",
//             "votes": 0,
//             "imageUrl": "https://images.squarespace-cdn.com/content/v1/5e0b0fd78f155213d53dd441/faec5302-c79d-4f58-8034-3ea0562c44e1/A-chart-showing-Reddit-in-the-top-10-social-media-apps-used-by-students.jpg"
//         },
//         {
//             "id": "sm_discord",
//             "name": "Discord",
//             "votes": 0,
//             "imageUrl": "https://t10589978.p.clickup-attachments.com/t10589978/3ff98c0b-4623-49ac-a489-0b036412db71/image.png"
//         },
//         {
//             "id": "sm_facebook",
//             "name": "Facebook",
//             "votes": 0,
//             "imageUrl": "https://www.usm.edu/news/2024/_images/facebook-logo.jpeg"
//         },
//         {
//             "id": "sm_twitch",
//             "name": "Twitch",
//             "votes": 0,
//             "imageUrl": "https://d12jofbmgge65s.cloudfront.net/wp-content/uploads/2022/01/app_review_twitch_icon.png"
//         },
//         {
//             "id": "sm_pinterest",
//             "name": "Pinterest",
//             "votes": 0,
//             "imageUrl": "https://compote.slate.com/images/4c4a2b1d-3e84-4533-9f23-2e490aa23fee.jpeg?crop=1560%2C1040%2Cx0%2Cy0"
//         }
//     ],
//     "fast_food_fries": [
//         {
//             "id": "fff_mcdonalds",
//             "name": "McDonald's",
//             "votes": 0,
//             "imageUrl": "https://s7d1.scene7.com/is/image/mcdonalds/DC_202411_6050_SmallFrenchFries_Standing_McValueRegistered_1564x1564:product-header-mobile?wid=1313&hei=1313&dpr=off"
//         },
//         {
//             "id": "fff_wendys",
//             "name": "Wendy's",
//             "votes": 0,
//             "imageUrl": "https://www.foodandwine.com/thmb/RnvdKTNqtdjTft-oxIVmNjsM2C8=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Wendys-Hot-Crispy-Fries-FT-BLOG0821-e75e6fba62c04ad9a93a70b04a5cd7f0.jpg"
//         },
//         {
//             "id": "fff_fiveguys",
//             "name": "Five Guys",
//             "votes": 0,
//             "imageUrl": "https://www.fiveguys.com/wp-content/uploads/2025/06/FG-Web-Regular-Fry-Menu-Item.jpg"
//         },
//         {
//             "id": "fff_chikfila",
//             "name": "Chick-fil-A (Waffle)",
//             "votes": 0,
//             "imageUrl": "https://www.chick-fil-a.com/wp-content/uploads/sites/2/2025/05/cfa14300winter24_medium_fries_plp_hero_d710x580_jpg_master_jpg.jpg"
//         },
//         {
//             "id": "fff_arbys",
//             "name": "Arby's (Curly)",
//             "votes": 0,
//             "imageUrl": "https://www.kroger.com/product/images/large/front/0004330137000"
//         },
//         {
//             "id": "fff_burgerking",
//             "name": "Burger King",
//             "votes": 0,
//             "imageUrl": "https://compote.slate.com/images/c72f30b4-4e25-46dc-b1f4-b6a7063b3d56.jpeg?crop=1558%2C1039%2Cx0%2Cy0"
//         },
//         {
//             "id": "fff_checkers",
//             "name": "Checkers / Rally's",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/asr/4478b59a-13ae-4695-ba96-36c825568dbb.1675a1a3ed37f6e9316413eed3cfa931.jpeg?odnHeight=768&odnWidth=768&odnBg=FFFFFF"
//         },
//         {
//             "id": "fff_innout",
//             "name": "In-N-Out",
//             "votes": 0,
//             "imageUrl": "https://assets.dmagstatic.com/wp-content/uploads/2017/05/2017-05-01-16.41.24-4-e1493676671236.jpg"
//         },
//         {
//             "id": "fff_popeyes",
//             "name": "Popeyes",
//             "votes": 0,
//             "imageUrl": "https://popeyesmenuusa.com/wp-content/uploads/2025/03/Popeyes-Cajun-Fries.webp"
//         },
//         {
//             "id": "fff_shakeshack",
//             "name": "Shake Shack",
//             "votes": 0,
//             "imageUrl": "https://www.mashed.com/img/gallery/the-untold-truth-of-shake-shacks-fries/intro-1652208267.jpg"
//         }
//     ],
//     "chips": [
//         {
//             "id": "ch_doritos_nacho",
//             "name": "Doritos Nacho Cheese",
//             "votes": 0,
//             "imageUrl": "https://www.kroger.com/product/images/large/front/0002840009089"
//         },
//         {
//             "id": "ch_doritos_cool",
//             "name": "Doritos Cool Ranch",
//             "votes": 0,
//             "imageUrl": "https://cdnimg.webstaurantstore.com/images/products/large/468305/2310251.jpg"
//         },
//         {
//             "id": "ch_cheetos",
//             "name": "Cheetos",
//             "votes": 0,
//             "imageUrl": "https://www.kroger.com/product/images/xlarge/front/0002840058986"
//         },
//         {
//             "id": "ch_takis",
//             "name": "Takis Fuego",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Takis-Fuego-Chippz-8-oz-Sharing-Size-Bag-Hot-Chili-Pepper-Lime-Thin-Cut-Potato-Chips_24d88ebb-fe57-4eff-b4d0-a3f0645128c3.333f34f95fb631a5214bbca5efe0e6a3.jpeg"
//         },
//         {
//             "id": "ch_pringles_orig",
//             "name": "Pringles Original",
//             "votes": 0,
//             "imageUrl": "https://images.heb.com/is/image/HEBGrocery/002083687-1"
//         },
//         {
//             "id": "ch_lays_classic",
//             "name": "Lay's Classic",
//             "votes": 0,
//             "imageUrl": "https://www.kroger.com/product/images/xlarge/front/0002840019914"
//         },
//         {
//             "id": "ch_ruffles_sour",
//             "name": "Ruffles Sour Cream & Onion",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/asr/b10abf78-c2ca-4bba-b064-cd040b6baa81.3f6a244ccde6285d20b5594d16e54d44.jpeg"
//         },
//         {
//             "id": "ch_funyuns",
//             "name": "Funyuns",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/91D2DqydjIL.jpg"
//         },
//         {
//             "id": "ch_fritos",
//             "name": "Fritos",
//             "votes": 0,
//             "imageUrl": "https://assets.bonappetit.com/photos/5e1793b308f7ca00089eae28/16:9/w_2560%2Cc_limit/0120-BASICALLY-WEB3284.jpg"
//         },
//         {
//             "id": "ch_sun_chips",
//             "name": "Sun Chips Harvest Cheddar",
//             "votes": 0,
//             "imageUrl": "https://target.scene7.com/is/image/Target/GUEST_4f4f9f68-a714-4a68-a977-c7797995b9c9"
//         }
//     ],
//     "dog_breeds": [
//         {
//             "id": "dog_golden",
//             "name": "Golden Retriever",
//             "votes": 0,
//             "imageUrl": "https://pet-health-content-media.chewy.com/wp-content/uploads/2024/09/11181524/202104golden-retriever-puppy.jpg"
//         },
//         {
//             "id": "dog_lab",
//             "name": "Labrador Retriever",
//             "votes": 0,
//             "imageUrl": "https://www.akc.org/wp-content/uploads/2017/11/Labrador-Retrievers-three-colors.jpg"
//         },
//         {
//             "id": "dog_gsd",
//             "name": "German Shepherd",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/d/d0/German_Shepherd_-_DSC_0346_%2810096362833%29.jpg"
//         },
//         {
//             "id": "dog_bulldog",
//             "name": "Bulldog",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/b/bf/Bulldog_inglese.jpg"
//         },
//         {
//             "id": "dog_frenchie",
//             "name": "French Bulldog",
//             "votes": 0,
//             "imageUrl": "https://www.akc.org/wp-content/uploads/2017/11/French-Bulldog-standing-outdoors.jpg"
//         },
//         {
//             "id": "dog_poodle",
//             "name": "Poodle",
//             "votes": 0,
//             "imageUrl": "https://www.akc.org/wp-content/uploads/2017/11/Standard-Poodle-standing-outdoors-at-the-beach.jpg"
//         },
//         {
//             "id": "dog_beagle",
//             "name": "Beagle",
//             "votes": 0,
//             "imageUrl": "https://cdn.britannica.com/80/29280-050-A3A13277/Beagles-pets.jpg"
//         },
//         {
//             "id": "dog_rottie",
//             "name": "Rottweiler",
//             "votes": 0,
//             "imageUrl": "https://headsupfortails.com/cdn/shop/articles/Rottweiler_Dog_Breed_Guide-_Temperament_Appearance_Care_History.jpg?v=1758005579"
//         },
//         {
//             "id": "dog_husky",
//             "name": "Siberian Husky",
//             "votes": 0,
//             "imageUrl": "https://www.akc.org/wp-content/uploads/2017/11/Siberian-Husky-standing-outdoors-in-the-winter.jpg"
//         },
//         {
//             "id": "dog_pug",
//             "name": "Pug",
//             "votes": 0,
//             "imageUrl": "https://www.akc.org/wp-content/uploads/2017/11/Pug-On-White-01.jpg"
//         }
//     ],
//     "cn_shows": [
//         {
//             "id": "cn_teentitans",
//             "name": "Teen Titans",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOTg3NzY2MDQtMjUxNS00N2Q3LTkxODktMmU1NzdjZTNkMzQ0XkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "cn_dexter",
//             "name": "Dexter's Laboratory",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BYmE4ZmI4YzMtYTU4My00YTRiLWIzOGEtOWEzNWYxM2NjYzgzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "cn_powerpuff",
//             "name": "Powerpuff Girls",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BODY3YjMyOTktZWFiZS00MGNkLWExZjUtYjJjYjljMGM1YWY4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "cn_ededdneddy",
//             "name": "Ed, Edd n Eddy",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOWNmY2Y0MDUtMmM4Zi00NGEzLWI1MjEtMDUzYmM2MzFjNTU2XkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "cn_courage",
//             "name": "Courage the Cowardly Dog",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMzdiMWI4OGMtZDc2MC00NDllLTgyMWUtN2ZmZjVlYWFkYjQxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "cn_samuraijack",
//             "name": "Samurai Jack",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BNjU4ZmVhZGMtNTU4Yy00YmZhLTlmOGQtNGMwMTcwNTEyZjQ0XkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "cn_ben10",
//             "name": "Ben 10",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BYWVjODZjNDgtYjk4ZS00OTg5LTg5NDQtZDMxZDQ4ZmM5MGJmXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "cn_johnnybravo",
//             "name": "Johnny Bravo",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BM2M5YjYxZTktYzIzNi00MjkxLTljYTEtYjllNWY3Y2RkMTYwXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "cn_knd",
//             "name": "Codename: Kids Next Door",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMTdkNmY4ZGMtZTk3YS00OWUxLTlmNTktZTAxNTg1MWM2YmM2XkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "cn_grim",
//             "name": "The Grim Adventures of Billy & Mandy",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BN2FjZmVkNDEtNzQ5My00MDkyLTg0Y2ItYjhkOWJhNGVhYjJiXkEyXkFqcGc@._V1_.jpg"
//         }
//     ],
//     "nick_shows": [
//         {
//             "id": "nk_spongebob",
//             "name": "SpongeBob SquarePants",
//             "votes": 0,
//             "imageUrl": "https://ntvb.tmsimg.com/assets/p12180925_b_h10_aa.jpg?w=1280&h=720"
//         },
//         {
//             "id": "nk_avatar",
//             "name": "Avatar: The Last Airbender",
//             "votes": 0,
//             "imageUrl": "https://deadline.com/wp-content/uploads/2021/02/Avatar-The-Last-Airbender-Legend-Of-Aang-Nickelodeon-Nick-ATLA-ATLOA-e1655304503771.jpg"
//         },
//         {
//             "id": "nk_fairly",
//             "name": "The Fairly OddParents",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BY2RlNWMwZmUtMjM4MC00MDczLTk3NjktYTg2OTNiNThhNmNhXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "nk_rugrats",
//             "name": "Rugrats",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOTkwZWRjZjktMDQyMy00MjljLWIzMmMtMjc2OTNiNGY2YzkzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "nk_heyarnold",
//             "name": "Hey Arnold!",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BYzhiYTYwM2QtNTlmNy00MGM1LTllM2UtOGJmZTUxMmJmZjdiXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "nk_invaderzim",
//             "name": "Invader Zim",
//             "votes": 0,
//             "imageUrl": "https://d2biqbseuutm43.cloudfront.net/wp-content/uploads/2021/09/23111025/NAS-invaderzim-1-e1632929778412.png"
//         },
//         {
//             "id": "nk_dannyphantom",
//             "name": "Danny Phantom",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/nickelodeon/images/1/1e/Danny_Phantom_Title_Card.jpg/revision/latest?cb=20130414011956"
//         },
//         {
//             "id": "nk_jimmyneutron",
//             "name": "Jimmy Neutron",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BN2E4MWQwYjEtNzJjZC00OTkxLTkyZGMtYTQxYmUyOWZiMTgyXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "nk_catdog",
//             "name": "CatDog",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/thumb/6/64/CatDog.jpeg/250px-CatDog.jpeg"
//         },
//         {
//             "id": "nk_rocketpower",
//             "name": "Rocket Power",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BZTdiNGJkYjAtNDBmZS00OWVmLWIwZDUtYjUyMTQ1MDJmYTIyXkEyXkFqcGc@._V1_.jpg"
//         }
//     ],
//     "breakfast": [
//         {
//             "id": "bf_pancakes",
//             "name": "Pancakes",
//             "votes": 0,
//             "imageUrl": "https://cdn.loveandlemons.com/wp-content/uploads/2025/09/protein-pancakes.jpg"
//         },
//         {
//             "id": "bf_waffles",
//             "name": "Waffles",
//             "votes": 0,
//             "imageUrl": "https://cravinghomecooked.com/wp-content/uploads/2019/02/easy-waffle-recipe-1-16.jpg"
//         },
//         {
//             "id": "bf_bacon",
//             "name": "Bacon",
//             "votes": 0,
//             "imageUrl": "https://res.cloudinary.com/anova-applied-electronics/image/upload/v1676560772/mobileProduction/kawpr6dpcpmwqwflbiz3.jpg"
//         },
//         {
//             "id": "bf_eggs",
//             "name": "Eggs",
//             "votes": 0,
//             "imageUrl": "https://www.seriouseats.com/thmb/RLhIA1_2ZVdLa-uPVV9YRt75g20=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/__opt__aboutcom__coeus__resources__content_migration__serious_eats__seriouseats.com__recipes__images__2017__07__20170728-sunny-side-up-eggs-vicky-wasik-d07c5480d72e49cc85689c1d6d88495e.jpg"
//         },
//         {
//             "id": "bf_frenchtoast",
//             "name": "French Toast",
//             "votes": 0,
//             "imageUrl": "https://cdn.loveandlemons.com/wp-content/uploads/2024/08/french-toast-recipe.jpg"
//         },
//         {
//             "id": "bf_hashbrowns",
//             "name": "Hash Browns",
//             "votes": 0,
//             "imageUrl": "https://www.simplyrecipes.com/thmb/mRV2rMVLAh2NRxqHxz9j5-YV92c=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/Simply-Best-Crispy-Hash-Browns-LEAD-5-423c2ec1d31d47be90c11cb841152621.jpg"
//         },
//         {
//             "id": "bf_bagel",
//             "name": "Bagel with Cream Cheese",
//             "votes": 0,
//             "imageUrl": "https://www.layersofhappiness.com/wp-content/uploads/2023/07/Everything-Bagel-Breakfast-Sandwich-6-scaled.jpg"
//         },
//         {
//             "id": "bf_sausage",
//             "name": "Breakfast Sausage",
//             "votes": 0,
//             "imageUrl": "https://www.allrecipes.com/thmb/Xno7dT2Fhg9EJt_tXP0ezsAwEVE=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/16359-breakfast-sausage-DDMFS-4x3-b2172456aa614158a0c5e710a75215ae.jpg"
//         },
//         {
//             "id": "bf_cereal",
//             "name": "Cereal",
//             "votes": 0,
//             "imageUrl": "https://notablyvegan.com/wp-content/uploads/2023/09/homemade-healthy-cereal-21.jpg"
//         },
//         {
//             "id": "bf_oatmeal",
//             "name": "Oatmeal",
//             "votes": 0,
//             "imageUrl": "https://www.veggieinspired.com/wp-content/uploads/2015/05/healthy-oatmeal-berries-featured.jpg"
//         }
//     ],
//     "smash_bros": [
//         {
//             "id": "smsh_mario",
//             "name": "Mario",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/ssb/images/0/07/Mario_-_Super_Smash_Bros._Ultimate.png/revision/latest?cb=20180910105834"
//         },
//         {
//             "id": "smsh_link",
//             "name": "Link",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/link/main.png"
//         },
//         {
//             "id": "smsh_kirby",
//             "name": "Kirby",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/ssb/images/9/92/Kirby_-_Super_Smash_Bros._Ultimate.png/revision/latest?cb=20190715072044"
//         },
//         {
//             "id": "smsh_fox",
//             "name": "Fox",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/fox/main.png"
//         },
//         {
//             "id": "smsh_pikachu",
//             "name": "Pikachu",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/pikachu/main.png"
//         },
//         {
//             "id": "smsh_captainfalcon",
//             "name": "Captain Falcon",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/captain_falcon/main.png"
//         },
//         {
//             "id": "smsh_samus",
//             "name": "Samus",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/samus/main.png"
//         },
//         {
//             "id": "smsh_jigglypuff",
//             "name": "Jigglypuff",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/jigglypuff/main.png"
//         },
//         {
//             "id": "smsh_ness",
//             "name": "Ness",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/ness/main.png"
//         },
//         {
//             "id": "smsh_donkeykong",
//             "name": "Donkey Kong",
//             "votes": 0,
//             "imageUrl": "https://www.smashbros.com/assets_v2/img/fighter/donkey_kong/main.png"
//         }
//     ],
//     "car_brands": [
//         {
//             "id": "car_toyota",
//             "name": "Toyota",
//             "votes": 0,
//             "imageUrl": "https://d3ogcz7gf2u1oh.cloudfront.net/dealers/1000islands/assets/2019yaris.png"
//         },
//         {
//             "id": "car_honda",
//             "name": "Honda",
//             "votes": 0,
//             "imageUrl": "https://di-uploads-pod14.dealerinspire.com/hondaeastcincy/uploads/2023/03/2303-CR-V-LX-Thumb.jpg"
//         },
//         {
//             "id": "car_ford",
//             "name": "Ford",
//             "votes": 0,
//             "imageUrl": "https://images.app.ridemotive.com/j2hh5uqfem35cwthnes6omefzvc1"
//         },
//         {
//             "id": "car_chevrolet",
//             "name": "Chevrolet",
//             "votes": 0,
//             "imageUrl": "https://www.chevrolet.com/content/dam/chevrolet/na/us/english/index/all-vehicles/masthead/v-two/allvehiclespage-mh-v2.png?imwidth=1200"
//         },
//         {
//             "id": "car_bmw",
//             "name": "BMW",
//             "votes": 0,
//             "imageUrl": "https://lookaside.fbsbx.com/lookaside/crawler/media/?media_id=1124966302973603"
//         },
//         {
//             "id": "car_mercedes",
//             "name": "Mercedes-Benz",
//             "votes": 0,
//             "imageUrl": "https://s19532.pcdn.co/wp-content/uploads/2018/03/mercedesbenz.jpg"
//         },
//         {
//             "id": "car_tesla",
//             "name": "Tesla",
//             "votes": 0,
//             "imageUrl": "https://www.kantar.com/north-america/-/media/project/kantar/global/articles/images/2021/tesla-most-valuable-auto-brand.jpg"
//         },
//         {
//             "id": "car_audi",
//             "name": "Audi",
//             "votes": 0,
//             "imageUrl": "https://i.gaw.to/content/photos/55/02/550276-audi-est-elle-une-marque-fiable.jpeg"
//         },
//         {
//             "id": "car_subaru",
//             "name": "Subaru",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Subaru_logo_%28transparent%29.svg"
//         },
//         {
//             "id": "car_porsche",
//             "name": "Porsche",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/9/96/Newporschecrest.jpg"
//         }
//     ],
//     "harry_potter": [
//         {
//             "id": "hp_sorcerers",
//             "name": "Sorcerer's Stone",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/91wKDODkgWL._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "hp_chamber",
//             "name": "Chamber of Secrets",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/915KEvGiX-L._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "hp_azkaban",
//             "name": "Prisoner of Azkaban",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81NQA1BDlnL._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "hp_goblet",
//             "name": "Goblet of Fire",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/91-LL7OnDCL._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "hp_order",
//             "name": "Order of the Phoenix",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81BXnTqH7-L._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "hp_halfblood",
//             "name": "Half-Blood Prince",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81VsN7EOBfL._AC_UF1000,1000_QL80_.jpg"
//         },
//         {
//             "id": "hp_hallows1",
//             "name": "Deathly Hallows: Part 1",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMTQ2OTE1Mjk0N15BMl5BanBnXkFtZTcwODE3MDAwNA@@._V1_.jpg"
//         },
//         {
//             "id": "hp_hallows2",
//             "name": "Deathly Hallows: Part 2",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/d/df/Harry_Potter_and_the_Deathly_Hallows_%E2%80%93_Part_2.jpg"
//         }
//     ],
//     "disney_villains": [
//         {
//             "id": "dv_scar",
//             "name": "Scar",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/4/4d/Scar_lion_king.png"
//         },
//         {
//             "id": "dv_maleficent",
//             "name": "Maleficent",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/disney/images/0/05/Profile_-_Maleficent.jpeg/revision/latest?cb=20250118085922"
//         },
//         {
//             "id": "dv_ursula",
//             "name": "Ursula",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/e/e3/Ursula%28TheLittleMermaid%29character.png"
//         },
//         {
//             "id": "dv_jafar",
//             "name": "Jafar",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/c/c3/Jafar%28Disney%29Character.png"
//         },
//         {
//             "id": "dv_hades",
//             "name": "Hades",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/villains/images/2/27/Hades_Disney_transparent.png/revision/latest?cb=20200206010508"
//         },
//         {
//             "id": "dv_cruella",
//             "name": "Cruella de Vil",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/6/64/Cruella_de_Vil.png"
//         },
//         {
//             "id": "dv_gaston",
//             "name": "Gaston",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/a/a7/Gaston%28BeautyandtheBeast%29.png"
//         },
//         {
//             "id": "dv_hook",
//             "name": "Captain Hook",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/5/58/Captain_James_Hook_%28Disney_animated_character%29.png"
//         },
//         {
//             "id": "dv_facilier",
//             "name": "Dr. Facilier",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/villains/images/e/e5/Facilier_transparent.png/revision/latest/scale-to-width-down/1200?cb=20190108013402"
//         },
//         {
//             "id": "dv_frollo",
//             "name": "Judge Claude Frollo",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/2/29/ClaudeFrollo.PNG"
//         }
//     ],
//     "streaming": [
//         {
//             "id": "str_netflix",
//             "name": "Netflix",
//             "votes": 0,
//             "imageUrl": "https://cdn.aarp.net/content/dam/aarp/entertainment/television/2021/09/1140-netflix-recommendations.jpg"
//         },
//         {
//             "id": "str_hulu",
//             "name": "Hulu",
//             "votes": 0,
//             "imageUrl": "https://static-assets.bamgrid.com/product/hulu/images/share-default.7f156ebe6f32f73b27049839152ec93b.jpg"
//         },
//         {
//             "id": "str_max",
//             "name": "Max (HBO)",
//             "votes": 0,
//             "imageUrl": "https://deadline.com/wp-content/uploads/2023/04/Screen-Shot-2023-04-12-at-10.29.21-AM.jpg"
//         },
//         {
//             "id": "str_disney",
//             "name": "Disney+",
//             "votes": 0,
//             "imageUrl": "https://cdn1.edgedatg.com/aws/v2/abc/DisneyPlusMisc/blog/2886298/f3d706ceadcc7226d19241b76894e828/512x288-Q90_f3d706ceadcc7226d19241b76894e828.jpg"
//         },
//         {
//             "id": "str_prime",
//             "name": "Amazon Prime Video",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/G/01/primevideo/seo/primevideo-seo-logo.png"
//         },
//         {
//             "id": "str_apple",
//             "name": "Apple TV+",
//             "votes": 0,
//             "imageUrl": "https://cdn.mos.cms.futurecdn.net/rX7EpGba5Z2c564JHkbsaT.jpg"
//         },
//         {
//             "id": "str_peacock",
//             "name": "Peacock",
//             "votes": 0,
//             "imageUrl": "https://i.pcmag.com/imagery/reviews/03trTp5ePbLXUpe661Udw6B-1..v1594828762.png"
//         },
//         {
//             "id": "str_paramount",
//             "name": "Paramount+",
//             "votes": 0,
//             "imageUrl": "https://wwwimage-us.pplusstatic.com/base/files/seo/paramount-plus_25.png?format=webp"
//         },
//         {
//             "id": "str_crunchyroll",
//             "name": "Crunchyroll",
//             "votes": 0,
//             "imageUrl": "https://static.crunchyroll.com/cr-acquisition/assets/img/start/hero/us-global/background-desktop.jpg"
//         },
//         {
//             "id": "str_tubi",
//             "name": "Tubi",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/715irEQPXzL.png"
//         }
//     ],
//     "fruits": [
//         {
//             "id": "fr_strawberry",
//             "name": "Strawberry",
//             "votes": 0,
//             "imageUrl": "http://clv.h-cdn.co/assets/15/22/2048x2048/square-1432664914-strawberry-facts1.jpg"
//         },
//         {
//             "id": "fr_watermelon",
//             "name": "Watermelon",
//             "votes": 0,
//             "imageUrl": "https://weresmartworld.com/sites/default/files/styles/full_screen/public/2021-04/watermeloen_2.jpg?itok=CCYHLr5M"
//         },
//         {
//             "id": "fr_mango",
//             "name": "Mango",
//             "votes": 0,
//             "imageUrl": "https://www.svz.com/wp-content/uploads/2018/05/Mango.jpg"
//         },
//         {
//             "id": "fr_banana",
//             "name": "Banana",
//             "votes": 0,
//             "imageUrl": "https://chefsmandala.com/wp-content/uploads/2018/03/Banana.jpg"
//         },
//         {
//             "id": "fr_apple",
//             "name": "Apple",
//             "votes": 0,
//             "imageUrl": "https://static.libertyprim.com/files/familles/pomme-large.jpg?1569271834"
//         },
//         {
//             "id": "fr_pineapple",
//             "name": "Pineapple",
//             "votes": 0,
//             "imageUrl": "https://asian-veggies.com/cdn/shop/products/71_qAJehpkL.jpg?v=1668222481"
//         },
//         {
//             "id": "fr_grapes",
//             "name": "Grapes",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/fruit/images/a/a1/Download_%286%29.jpg/revision/latest?cb=20250214145209"
//         },
//         {
//             "id": "fr_peach",
//             "name": "Peach",
//             "votes": 0,
//             "imageUrl": "https://static.libertyprim.com/files/familles/peche-large.jpg?1574630286"
//         },
//         {
//             "id": "fr_orange",
//             "name": "Orange",
//             "votes": 0,
//             "imageUrl": "https://www.fruitsmith.com/pub/media/wysiwyg/Orange.jpg"
//         },
//         {
//             "id": "fr_blueberry",
//             "name": "Blueberry",
//             "votes": 0,
//             "imageUrl": "https://www.freshpoint.com/wp-content/uploads/commodity-blueberry.jpg"
//         }
//     ],
//     "anime": [
//         {
//             "id": "an_dbz",
//             "name": "Dragon Ball Z",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BN2VlNTdlMzQtYzE5OC00YmYwLTgyZTItYjEzMWY0ZDNjMTJhXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "an_naruto",
//             "name": "Naruto",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BZTNjOWI0ZTAtOGY1OS00ZGU0LWEyOWYtMjhkYjdlYmVjMDk2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "an_onepiece",
//             "name": "One Piece",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMTNjNGU4NTUtYmVjMy00YjRiLTkxMWUtNzZkMDNiYjZhNmViXkEyXkFqcGc@._V1_QL75_UY281_CR8,0,190,281_.jpg"
//         },
//         {
//             "id": "an_aot",
//             "name": "Attack on Titan",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BZjliODY5MzQtMmViZC00MTZmLWFhMWMtMjMwM2I3OGY1MTRiXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "an_deathnote",
//             "name": "Death Note",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BYTgyZDhmMTEtZDFhNi00MTc4LTg3NjUtYWJlNGE5Mzk2NzMxXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "an_bleach",
//             "name": "Bleach",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOWQwOWY5NTUtMjAyZi00YjQzLTkwODgtNmQwZjU1MGIzZDhjXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "an_fmab",
//             "name": "Fullmetal Alchemist: Brohood",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMzNiODA5NjYtYWExZS00OTc4LTg3N2ItYWYwYTUyYmM5MWViXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "an_hunter",
//             "name": "Hunter x Hunter",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BYzYxOTlkYzctNGY2MC00MjNjLWIxOWMtY2QwYjcxZWIwMmEwXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "an_jujutsu",
//             "name": "Jujutsu Kaisen",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/jujutsu-kaisen/images/8/88/Anime_Key_Visual_2.png/revision/latest/scale-to-width-down/1200?cb=20201212034001"
//         },
//         {
//             "id": "an_demonslayer",
//             "name": "Demon Slayer",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMWU1OGEwNmQtNGM3MS00YTYyLThmYmMtN2FjYzQzNzNmNTE0XkEyXkFqcGc@._V1_.jpg"
//         }
//     ],
//     "sitcoms": [
//         {
//             "id": "sit_office",
//             "name": "The Office",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BZjQwYzBlYzUtZjhhOS00ZDQ0LWE0NzAtYTk4MjgzZTNkZWEzXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sit_friends",
//             "name": "Friends",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOTU2YmM5ZjctOGVlMC00YTczLTljM2MtYjhlNGI5YWMyZjFkXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sit_seinfeld",
//             "name": "Seinfeld",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMmRjNjZjN2ItN2FkYi00ZDg0LWExN2EtMTU2ODUwNWU1M2NhXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sit_parks",
//             "name": "Parks and Recreation",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BNDlhMzAwNTAtNTk2NS00MTdkLWE3ZWYtMDU0MTFiYmU2ZTc0XkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sit_brooklyn",
//             "name": "Brooklyn Nine-Nine",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BNzBiODQxZTUtNjc0MC00Yzc1LThmYTMtN2YwYTU3NjgxMmI4XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "sit_himym",
//             "name": "How I Met Your Mother",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BNjg1MDQ5MjQ2N15BMl5BanBnXkFtZTYwNjI5NjA3._V1_.jpg"
//         },
//         {
//             "id": "sit_sunny",
//             "name": "It's Always Sunny",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMTFiMDg5ZTItNWU2Ni00YzJlLWE4NTQtZjUwNWFhOTViYTk2XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg"
//         },
//         {
//             "id": "sit_arrested",
//             "name": "Arrested Development",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BMzA1NzBiMzUtZTA1Zi00YTVjLTkxZWYtZTIyYzFhMzVjZmQ1XkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sit_community",
//             "name": "Community",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/M/MV5BOGIwYzNmYTktZWExZC00MzAyLTk4NTItODgwZmIyNWZhNDEyXkEyXkFqcGc@._V1_.jpg"
//         },
//         {
//             "id": "sit_modern",
//             "name": "Modern Family",
//             "votes": 0,
//             "imageUrl": "https://static-secure.guim.co.uk/sys-images/Media/Columnists/Columnists/2011/9/23/1316783481889/Modern-Family-006.jpg"
//         }
//     ],
//     "shoes": [
//         {
//             "id": "sh_nike",
//             "name": "Nike",
//             "votes": 0,
//             "imageUrl": "https://static.nike.com/a/images/t_web_pdp_936_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/5482d0ee-6aea-4e99-8709-d90e4ea18733/W+AF1+SHADOW.png"
//         },
//         {
//             "id": "sh_adidas",
//             "name": "Adidas",
//             "votes": 0,
//             "imageUrl": "https://brand.assets.adidas.com/image/upload/f_auto,q_auto:best,fl_lossy/if_w_gt_600,w_600/shoes_women_tcc_d_234be42564.jpg"
//         },
//         {
//             "id": "sh_jordan",
//             "name": "Air Jordan",
//             "votes": 0,
//             "imageUrl": "https://dks.scene7.com/is/image/GolfGalaxy/23JDNMRJRDN1LWGBLGSH_White_University_Blue?wid=2000&hei=2000&fit=constrain&fmt=pjpeg"
//         },
//         {
//             "id": "sh_vans",
//             "name": "Vans",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/asr/d8c3eccb-5115-4754-a253-3be132cf3d4b.1b9a2ec97c7aa683a77b75476d17977d.jpeg"
//         },
//         {
//             "id": "sh_converse",
//             "name": "Converse",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Converse-Unisex-Chuck-Taylor-All-Star-High-Top-Casual-Athletic-Sneakers_a9a3a2a4-8ad6-48da-90fb-e11fde729a4a.5577946439e5e274a6412bc7014dc981.jpeg"
//         },
//         {
//             "id": "sh_newbalance",
//             "name": "New Balance",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/71pNzZcDUuL._AC_UY1000_.jpg"
//         },
//         {
//             "id": "sh_crocs",
//             "name": "Crocs",
//             "votes": 0,
//             "imageUrl": "https://www.srmax.com/images/products/cr209952-001-profile.jpg"
//         },
//         {
//             "id": "sh_puma",
//             "name": "Puma",
//             "votes": 0,
//             "imageUrl": "https://images.journeys.com/images/products/1_840867_FS.JPG"
//         },
//         {
//             "id": "sh_reebok",
//             "name": "Reebok",
//             "votes": 0,
//             "imageUrl": "https://www.reebok.com/cdn/shop/files/100009940_SLC_eCom_130fe992-6c6c-4291-8265-a66b13ad679b.jpg?v=1775049296"
//         },
//         {
//             "id": "sh_asics",
//             "name": "ASICS",
//             "votes": 0,
//             "imageUrl": "https://images.asics.com/is/image/asics/1012B681_002_SR_RT_GLB?$sfcc-product$"
//         }
//     ],
//     "pop_stars": [
//         {
//             "id": "pop_taylor",
//             "name": "Taylor Swift",
//             "votes": 0,
//             "imageUrl": "https://www.billboard.com/wp-content/uploads/2024/11/3-Taylor-Swift-hero-greatest-pop-stars-21st-2024-billboard-1548.jpg"
//         },
//         {
//             "id": "pop_beyonce",
//             "name": "Beyoncé",
//             "votes": 0,
//             "imageUrl": "https://www.billboard.com/wp-content/uploads/2024/12/1-beyonce-embed-hero-2024-billboard-1548.jpg?w=1292&h=861&crop=1"
//         },
//         {
//             "id": "pop_ariana",
//             "name": "Ariana Grande",
//             "votes": 0,
//             "imageUrl": "https://www.billboard.com/wp-content/uploads/2024/11/2019-Ariana-Grande-Greatest-Pop-Stars-by-Year-billboard-1240.jpg?w=942&h=628&crop=1"
//         },
//         {
//             "id": "pop_rihanna",
//             "name": "Rihanna",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/c2/Rihanna_Fenty_2018.png"
//         },
//         {
//             "id": "pop_dua",
//             "name": "Dua Lipa",
//             "votes": 0,
//             "imageUrl": "https://www.billboard.com/wp-content/uploads/2021/12/03-Dua-Lipa-greatest-pop-star-by-year-cr-Hugo-Comte.jpg"
//         },
//         {
//             "id": "pop_billie",
//             "name": "Billie Eilish",
//             "votes": 0,
//             "imageUrl": "https://i.insider.com/5df273e3e94e8638ed132ea9?width=700"
//         },
//         {
//             "id": "pop_ladygaga",
//             "name": "Lady Gaga",
//             "votes": 0,
//             "imageUrl": "https://www.billboard.com/wp-content/uploads/2024/11/5_Lady-Gaga_embed_hero-greatest-pop-star-billboard-no-logo-1548.jpg"
//         },
//         {
//             "id": "pop_katy",
//             "name": "Katy Perry",
//             "votes": 0,
//             "imageUrl": "https://cdn.britannica.com/91/154391-050-4F9D5FCD/Pop-music-sensation-Katy-Perry.jpg"
//         },
//         {
//             "id": "pop_miley",
//             "name": "Miley Cyrus",
//             "votes": 0,
//             "imageUrl": "https://ychef.files.bbci.co.uk/1280x720/p0f7td1l.jpg"
//         },
//         {
//             "id": "pop_selena",
//             "name": "Selena Gomez",
//             "votes": 0,
//             "imageUrl": "https://www.rollingstone.com/wp-content/uploads/2024/12/GettyImages-2188250439.jpg?w=1581&h=1054&crop=1"
//         }
//     ],
//     "emojis": [
//         {
//             "id": "em_laugh",
//             "name": "😂 Laughing",
//             "votes": 0,
//             "imageUrl": "https://media.istockphoto.com/id/1474792237/vector/laughing-smiling-emoji-face-emoticon.jpg?s=612x612&w=0&k=20&c=9RzT3ARYcrivgK-sckayblxtWwsm1-x4yHMmOoiSkTo="
//         },
//         {
//             "id": "em_skull",
//             "name": "💀 Skull",
//             "votes": 0,
//             "imageUrl": "https://em-content.zobj.net/social/emoji/skull.png"
//         },
//         {
//             "id": "em_fire",
//             "name": "🔥 Fire",
//             "votes": 0,
//             "imageUrl": "https://em-content.zobj.net/social/emoji/fire.png"
//         },
//         {
//             "id": "em_pleading",
//             "name": "🥺 Pleading",
//             "votes": 0,
//             "imageUrl": "https://images.emojiterra.com/google/android-11/512px/1f97a.png"
//         },
//         {
//             "id": "em_heart",
//             "name": "❤️ Red Heart",
//             "votes": 0,
//             "imageUrl": "https://hips.hearstapps.com/hmg-prod/images/heart-emoji-meanings-red-heart-65a8118311c0d.jpg"
//         },
//         {
//             "id": "em_sparkles",
//             "name": "✨ Sparkles",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Twemoji12_2728.svg/1280px-Twemoji12_2728.svg.png"
//         },
//         {
//             "id": "em_eyes",
//             "name": "👀 Eyes",
//             "votes": 0,
//             "imageUrl": "https://s3.amazonaws.com/pix.iemoji.com/images/emoji/apple/ios-18/256/0462.png"
//         },
//         {
//             "id": "em_sob",
//             "name": "😭 Sobbing",
//             "votes": 0,
//             "imageUrl": "https://images.emojiterra.com/google/android-11/512px/1f62d.png"
//         },
//         {
//             "id": "em_clown",
//             "name": "🤡 Clown",
//             "votes": 0,
//             "imageUrl": "https://www.shutterstock.com/image-vector/circus-clown-emoji-emoticon-red-600nw-2531660979.jpg"
//         },
//         {
//             "id": "em_shrug",
//             "name": "🤷 Shrug",
//             "votes": 0,
//             "imageUrl": "https://i.pinimg.com/736x/41/bb/84/41bb840bccf07e1dedd4aa3456151c87.jpg"
//         }
//     ],
//     "sports": [
//         {
//             "id": "sp_soccer",
//             "name": "Soccer (Football)",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/4/42/Football_in_Bloomington%2C_Indiana%2C_1995.jpg"
//         },
//         {
//             "id": "sp_basketball",
//             "name": "Basketball",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/0/06/Steph_Curry_%2851915116957%29.jpg"
//         },
//         {
//             "id": "sp_amfootball",
//             "name": "American Football",
//             "votes": 0,
//             "imageUrl": "https://cdn.britannica.com/23/240123-050-354D5F02/Jalen-Hurts-Super-Bowl-LVII.jpg"
//         },
//         {
//             "id": "sp_baseball",
//             "name": "Baseball",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/e/e7/Tommy_Milone_gives_up_a_home_run_to_Mike_Trout_on_May_21%2C_2017.jpg"
//         },
//         {
//             "id": "sp_tennis",
//             "name": "Tennis",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/9/94/2013_Australian_Open_-_Guillaume_Rufin.jpg"
//         },
//         {
//             "id": "sp_hockey",
//             "name": "Ice Hockey",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/3/39/Pittsburgh_Penguins%2C_Washington_Capitals%2C_Bryan_Rust_%2833744033514%29.jpg"
//         },
//         {
//             "id": "sp_golf",
//             "name": "Golf",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Golfer_swing.jpg"
//         },
//         {
//             "id": "sp_boxing",
//             "name": "Boxing",
//             "votes": 0,
//             "imageUrl": "https://cdn.britannica.com/76/187976-050-D8DA2DA7/Floyd-Mayweather-Jr-ducks-Philippines-Manny-Pacquiao-May-2-2015.jpg"
//         },
//         {
//             "id": "sp_mma",
//             "name": "MMA / UFC",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/4/49/UFC_131_Carwin_vs._JDS.jpg"
//         },
//         {
//             "id": "sp_volleyball",
//             "name": "Volleyball",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b0/Brasil_vence_a_Fran%C3%A7a_no_v%C3%B4lei_masculino_1037987-15.08.2016_ffz-6369.jpg"
//         }
//     ],
//     "superheroes": [
//         {
//             "id": "sh_spiderman",
//             "name": "Spider-Man",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/superheroes/images/b/be/Spider_Man.jpg/revision/latest?cb=20240514002856"
//         },
//         {
//             "id": "sh_batman",
//             "name": "Batman",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Batman_Detective_Comics_1000_Variant.jpg/250px-Batman_Detective_Comics_1000_Variant.jpg"
//         },
//         {
//             "id": "sh_superman",
//             "name": "Superman",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/3/35/Supermanflying.png"
//         },
//         {
//             "id": "sh_wolverine",
//             "name": "Wolverine",
//             "votes": 0,
//             "imageUrl": "https://static.wikia.nocookie.net/superheroes/images/b/bb/Wolverine_FtA.jpg/revision/latest?cb=20240829155917"
//         },
//         {
//             "id": "sh_ironman",
//             "name": "Iron Man",
//             "votes": 0,
//             "imageUrl": "https://wallpapers.com/images/file/marvel-avenger-iron-man-superhero-md9yicqpaxwuperq.jpg"
//         },
//         {
//             "id": "sh_captain",
//             "name": "Captain America",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/f/f4/Captain_America.png"
//         },
//         {
//             "id": "sh_wonderwoman",
//             "name": "Wonder Woman",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/6/6b/Wonder_Woman_750.jpg"
//         },
//         {
//             "id": "sh_flash",
//             "name": "The Flash",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/b/b7/Flash_%28Barry_Allen%29.png"
//         },
//         {
//             "id": "sh_thor",
//             "name": "Thor",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/3/3c/Chris_Hemsworth_as_Thor.jpg"
//         },
//         {
//             "id": "sh_hulk",
//             "name": "The Hulk",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/en/a/aa/Hulk_%28circa_2019%29.png"
//         }
//     ],
//     "holidays": [
//         {
//             "id": "hol_christmas",
//             "name": "Christmas",
//             "votes": 0,
//             "imageUrl": "https://i0.wp.com/anchor.hope.edu/wp-content/uploads/2019/11/christmas-1.png?fit=647%2C377&ssl=1"
//         },
//         {
//             "id": "hol_halloween",
//             "name": "Halloween",
//             "votes": 0,
//             "imageUrl": "https://media.swncdn.com/via/15030-istockgetty-images-plusinside-creative-house.jpg"
//         },
//         {
//             "id": "hol_thanksgiving",
//             "name": "Thanksgiving",
//             "votes": 0,
//             "imageUrl": "https://static.wixstatic.com/media/caf74b_7b275c9ad39a45919998e97cb9efa87b~mv2.jpeg/v1/fill/w_568,h_284,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/caf74b_7b275c9ad39a45919998e97cb9efa87b~mv2.jpeg"
//         },
//         {
//             "id": "hol_newyear",
//             "name": "New Year's Eve",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/b/b4/Fireworks_on_New_Year%27s_Eve_in_a_small_Swabian_village_%281%29%2C_brightened.jpg"
//         },
//         {
//             "id": "hol_valentines",
//             "name": "Valentine's Day",
//             "votes": 0,
//             "imageUrl": "https://images.foxtv.com/static.fox5ny.com/www.fox5ny.com/content/uploads/2022/01/764/432/Valentine-balloon.jpg?ve=1&tl=1"
//         },
//         {
//             "id": "hol_stpatricks",
//             "name": "St. Patrick's Day",
//             "votes": 0,
//             "imageUrl": "https://i.natgeofe.com/k/21fa63c9-4b61-4ae2-8ea6-b889aa529708/st-patricks-day-textimage_6_3x2.jpg"
//         },
//         {
//             "id": "hol_easter",
//             "name": "Easter",
//             "votes": 0,
//             "imageUrl": "https://c8.alamy.com/comp/FT7XA0/easter-eggs-cute-bunny-funny-decoration-happy-holidays!-FT7XA0.jpg"
//         },
//         {
//             "id": "hol_july4",
//             "name": "4th of July",
//             "votes": 0,
//             "imageUrl": "https://clubrunner.blob.core.windows.net/00000010506/Images/fireworks-fourth-july-display-american-flag-bald-eagle-32276648.jpg"
//         },
//         {
//             "id": "hol_mothersday",
//             "name": "Mother's Day",
//             "votes": 0,
//             "imageUrl": "https://images.squarespace-cdn.com/content/v1/5f9a15b197a14a30bbd80740/588f51ff-053d-4852-bb1d-b25d5af84c16/23189C15-C49B-43FD-82F5-AEBCCD2F8446_4_5005_c.jpeg"
//         },
//         {
//             "id": "hol_fathersday",
//             "name": "Father's Day",
//             "votes": 0,
//             "imageUrl": "https://www.holidays-and-observances.com/images/xdad-2533865_640.jpg.pagespeed.ic.vkJ0EryH20.jpg"
//         }
//     ],
//     "streamers": [
//         {
//             "id": "str_kai",
//             "name": "Kai Cenat",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/Ej3hz_deGYQ/sddefault.jpg"
//         },
//         {
//             "id": "str_speed",
//             "name": "IShowSpeed",
//             "votes": 0,
//             "imageUrl": "https://www.indy100.com/media-library/ishowspeed-says-hell-run-the-100-meter-dash-at-the-2028-olympics.jpg?id=55190468&width=980"
//         },
//         {
//             "id": "str_xqc",
//             "name": "xQc",
//             "votes": 0,
//             "imageUrl": "https://static01.nyt.com/images/2023/06/16/multimedia/16TWITCH-xQc-mpqt/16TWITCH-xQc-mpqt-mediumSquareAt3X.jpg"
//         },
//         {
//             "id": "str_caseoh",
//             "name": "CaseOh",
//             "votes": 0,
//             "imageUrl": "https://static-cdn.jtvnw.net/jtv_user_pictures/ef28ba12-c8ed-46d4-838b-a4c95ef5b469-profile_image-300x300.png"
//         },
//         {
//             "id": "str_jynxzi",
//             "name": "Jynxzi",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/8/8e/Jynxzi_ohnePixel_2025_01.png"
//         },
//         {
//             "id": "str_duke",
//             "name": "Duke Dennis",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/ca/Duke_Dennis_2023_%282%29.jpg"
//         },
//         {
//             "id": "str_adin",
//             "name": "Adin Ross",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/0/0b/Adin_Ross_in_2025.png"
//         },
//         {
//             "id": "str_ninja",
//             "name": "Ninja",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/c/cd/Krystalogy%2C_Jess%2C_Ninja%2C_and_Typical_Gamer_relaxing_in_the_State_Farm_Gamerhood_%2852899874282%29_%28cropped%29_3.jpg"
//         },
//         {
//             "id": "str_sketch",
//             "name": "Sketch",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/1_A82mtQzv0/sddefault.jpg"
//         },
//         {
//             "id": "str_asmongold",
//             "name": "Asmongold",
//             "votes": 0,
//             "imageUrl": "https://upload.wikimedia.org/wikipedia/commons/7/75/Asmongold_in_2022.jpg"
//         }
//     ],
//     "energy_drinks": [
//         {
//             "id": "en_monster",
//             "name": "Monster Energy",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/71h8e9D3oSL._AC_UF894,1000_QL80_.jpg"
//         },
//         {
//             "id": "en_redbull",
//             "name": "Red Bull",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81l1kIVTdHL._AC_UF350,350_QL80_.jpg"
//         },
//         {
//             "id": "en_ghost",
//             "name": "Ghost",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/GHOST-ENERGY-Zero-Sugars-Energy-Drink-SOUR-PATCH-KIDS-Blue-Raspberry-16-fl-oz-Can_aba4647d-f190-4a7c-af4b-8fe63466b970.a2285526e4a5cb7dda2b82476e8d7f3b.png"
//         },
//         {
//             "id": "en_celsius",
//             "name": "Celsius",
//             "votes": 0,
//             "imageUrl": "https://images.albertsons-media.com/is/image/ABS/960333827-C1N1?$ng-ecom-pdp-desktop$&defaultImage=Not_Available"
//         },
//         {
//             "id": "en_prime",
//             "name": "Prime Energy",
//             "votes": 0,
//             "imageUrl": "https://i5.walmartimages.com/seo/Prime-Energy-Sugar-Free-Energy-Drink-Dripsicle-16oz-Can_b9ba5d06-0be7-49a7-9bde-61253e86a8d9.ae926d262ec26ac27576f09555e2aa78.jpeg?odnHeight=768&odnWidth=768&odnBg=FFFFFF"
//         },
//         {
//             "id": "en_gfuel",
//             "name": "G Fuel",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/81lSHq4s69L.jpg"
//         },
//         {
//             "id": "en_bang",
//             "name": "Bang",
//             "votes": 0,
//             "imageUrl": "https://m.media-amazon.com/images/I/91IXFsZdvxL.jpg"
//         },
//         {
//             "id": "en_c4",
//             "name": "C4 Energy",
//             "votes": 0,
//             "imageUrl": "https://cellucor.com/cdn/shop/files/C4BEV_2498_Digital_Assets_Paid_Retail_PDP_HawaiianPunch_C4Energy_Launch_2000x2000-Hero-HWP.png?v=1717632561&width=1946"
//         },
//         {
//             "id": "en_reign",
//             "name": "Reign",
//             "votes": 0,
//             "imageUrl": "https://images.albertsons-media.com/is/image/ABS/970301697-C1N1?$ng-ecom-pdp-desktop$&defaultImage=Not_Available"
//         },
//         {
//             "id": "en_rockstar",
//             "name": "Rockstar",
//             "votes": 0,
//             "imageUrl": "https://images.albertsons-media.com/is/image/ABS/970008737-C1N1?$ng-ecom-pdp-desktop$&defaultImage=Not_Available"
//         }
//     ],
//     "sweaty_games": [
//         {
//             "id": "sw_fortnite",
//             "name": "Fortnite",
//             "votes": 0,
//             "imageUrl": "https://i.redd.it/btrdjy0m3d731.jpg"
//         },
//         {
//             "id": "sw_valorant",
//             "name": "Valorant",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/QDGApq_lJcQ/maxresdefault.jpg"
//         },
//         {
//             "id": "sw_warzone",
//             "name": "Warzone",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/Cx7qp4tPYmA/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLCdL1L8AFIO4uVePJQAe31juDKpZA"
//         },
//         {
//             "id": "sw_apex",
//             "name": "Apex Legends",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/zSVBx7whn_s/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLDI_UArLvN-fY1pr1C7JTPjlbyOOA"
//         },
//         {
//             "id": "sw_rainbow",
//             "name": "Rainbow Six Siege",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/kIFGe7P7_7k/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLB8HvpDx12kJHC8AK2UfZFGS2AwiQ"
//         },
//         {
//             "id": "sw_league",
//             "name": "League of Legends",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/BDoS8t8szRI/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLALA_hGkI6drStjaUx9t-S6ykh13A"
//         },
//         {
//             "id": "sw_rocket",
//             "name": "Rocket League",
//             "votes": 0,
//             "imageUrl": "https://external-preview.redd.it/this-game-is-sweaty-and-stressful-i-feel-like-im-too-old-v0-t-Kogk4jKHF0jqXbDK3GPCMtW6jQlsLRq--3Lac_6CE.png?format=pjpg&auto=webp&s=74db72372e2bce581e1e062af4fb5739238d365b"
//         },
//         {
//             "id": "sw_cs2",
//             "name": "CS2",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/vsVWvACwbAc/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLAfs02MVFwothPo4B3WP685wvxVaw"
//         },
//         {
//             "id": "sw_overwatch",
//             "name": "Overwatch 2",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/rogJMEyohWE/hq720.jpg?sqp=-oaymwEhCK4FEIIDSFryq4qpAxMIARUAAAAAGAElAADIQj0AgKJD&rs=AOn4CLBDevz-GyEBCetVXDfHOp9nB-vqVg"
//         },
//         {
//             "id": "sw_rust",
//             "name": "Rust",
//             "votes": 0,
//             "imageUrl": "https://i.ytimg.com/vi/05MJNiMUMeA/maxresdefault.jpg"
//         }
//     ]
//     };

//     // Loop through every category and wipe/seed them one by one
//     for (const [categoryName, itemsArray] of Object.entries(allCategories)) {
//         console.log(`⏳ Processing category: ${categoryName}...`);
        
//         // 1. BURN IT DOWN
//         const listRef = collection(db, `lists/${categoryName}/items`);
//         const snapshot = await getDocs(listRef);
//         const deletePromises = [];
        
//         snapshot.forEach(docSnap => {
//             deletePromises.push(deleteDoc(doc(db, `lists/${categoryName}/items`, docSnap.id)));
//         });
//         await Promise.all(deletePromises);

//         // 2. SEED IT WITH NEW DATA
//         for (const item of itemsArray) {
//             const itemRef = doc(db, `lists/${categoryName}/items`, item.id);
//             await setDoc(itemRef, {
//                 name: item.name,
//                 votes: item.votes,
//                 imageUrl: item.imageUrl 
//             });
//         }
//     }

//     console.log("✅ DONE! All 5 databases are fresh and seeded. Refresh the page.");
// };

let activeOvertakeCleanupTimer = null;
let lastTouchEnd = 0;

document.addEventListener(
  'touchend',
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  },
  { passive: false }
);
function triggerOvertakeEffect(winnerName, loserName) {
    const existing = document.querySelector('.overtake-wrapper');
    if (existing) existing.remove();

    if (activeOvertakeCleanupTimer) {
        clearTimeout(activeOvertakeCleanupTimer);
        activeOvertakeCleanupTimer = null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'overtake-wrapper';

    wrapper.innerHTML = `
        <div class="overtake-ribbon">New Leader: ${winnerName}</div>
        <div class="overtake-popup">
            <h1>💥 OVERTAKEN! 💥</h1>
            <p>${winnerName} crushed ${loserName}!</p>
        </div>
    `;
    document.body.appendChild(wrapper);

    const popup = wrapper.querySelector('.overtake-popup');
    const ribbon = wrapper.querySelector('.overtake-ribbon');

    if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
    sfxOvertake.play();
    let autoRemoveTimer = null;
    let closing = false;
    const baseTransform = 'translate(-50%, -50%)';

    const closeAll = () => {
        if (closing) return;
        closing = true;

        clearTimeout(autoRemoveTimer);

        ribbon.style.transition = 'transform 0.35s ease-in';
        ribbon.style.transform = 'translateY(-100%)';

        popup.style.transition = 'transform 0.35s ease-in, opacity 0.25s ease-in';
        popup.style.transform = `${baseTransform} scale(0.85)`;
        popup.style.opacity = '0';

        activeOvertakeCleanupTimer = setTimeout(() => {
            if (wrapper.isConnected) wrapper.remove();
            if (activeOvertakeCleanupTimer) {
                clearTimeout(activeOvertakeCleanupTimer);
                activeOvertakeCleanupTimer = null;
            }
        }, 380);
    };

    const startAutoRemove = () => {
        clearTimeout(autoRemoveTimer);
        autoRemoveTimer = setTimeout(closeAll, 2500);
    };

    startAutoRemove();

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let hasSwiped = false;

    popup.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        clearTimeout(autoRemoveTimer);

        isDragging = true;
        hasSwiped = false;
        startX = e.clientX;
        startY = e.clientY;

        popup.setPointerCapture(e.pointerId);
        popup.style.animation = 'none';
        popup.style.transition = 'none';
        popup.style.opacity = '1';
        popup.style.transform = baseTransform;
    });

    popup.addEventListener('pointermove', (e) => {
        if (!isDragging) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dist = Math.hypot(dx, dy);

        if (!hasSwiped && dist > 8) hasSwiped = true;

        if (hasSwiped) {
            const rotation = dx * 0.06;
            popup.style.transform = `${baseTransform} translate3d(${dx}px, ${dy}px, 0) rotate(${rotation}deg)`;
            popup.style.opacity = '1';
        }
    });

    popup.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        popup.releasePointerCapture(e.pointerId);

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (hasSwiped && (Math.abs(dx) > 60 || Math.abs(dy) > 60)) {
            const angle = Math.atan2(dy, dx);
            const flyX = Math.cos(angle) * 1200;
            const flyY = Math.sin(angle) * 1200;

            popup.style.transition = 'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s linear';
            popup.style.transform = `${baseTransform} translate3d(${flyX}px, ${flyY}px, 0) rotate(${dx * 0.15}deg)`;
            popup.style.opacity = '0';

            setTimeout(closeAll, 560);
        } else {
            popup.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s';
            popup.style.transform = baseTransform;
            popup.style.opacity = '1';
            startAutoRemove();
        }
    });

    popup.addEventListener('pointercancel', () => {
        isDragging = false;
        popup.style.transition = 'transform 0.35s ease, opacity 0.2s';
        popup.style.transform = baseTransform;
        popup.style.opacity = '1';
        startAutoRemove();
    });
}
// --- JUICE: Milestone Nuke ---
function triggerMilestoneNuke(name, totalVotes) {
    // 1. Screen Flashbang
    const flash = document.createElement('div');
    flash.classList.add('flash-bang');
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 800);

    // 2. The Golden Banner
    const banner = document.createElement('div');
    banner.classList.add('milestone-banner');
    
    // Round down to the nearest 100 for the banner text
    const milestoneNumber = Math.floor(totalVotes / 100) * 100;

    banner.innerHTML = `
        <p>${name.toUpperCase()} HIT</p>
        <h1>${milestoneNumber.toLocaleString()}</h1>
        <p>VOTES!</p>
    `;
    document.body.appendChild(banner);

    // 3. Massive Haptic Feedback
    if(navigator.vibrate) navigator.vibrate([200, 50, 200, 50, 500]);

    // 4. Clean up DOM
    setTimeout(() => banner.remove(), 2000);
}
// --- VIRAL SHARING MECHANIC ---
window.triggerNativeShare = async function(context) {
    playCameraSnap();
    const shareData = {
        title: 'Rank Riot!',
        text: context === 'Battle' 
            ? '🚨 My guy is losing! Get in here and help me mash the vote!' 
            : '🔥 Enter the battlefield. Who is the undisputed GOAT?',
        url: window.location.href // Automatically grabs your live URL
    };

    // Huge haptic bump when they click share
    if(navigator.vibrate) navigator.vibrate(150);

    try {
        if (navigator.share) {
            // Opens the native phone sharing menu (iMessage, Insta, Snap, etc.)
            await navigator.share(shareData);
            console.log('Successfully shared!');
        } else {
            // Fallback for Desktop: Copy link to clipboard
            await navigator.clipboard.writeText(window.location.href);
        }
    } catch (err) {
        console.log('Share canceled or failed:', err);
    }
};
function playWooshSound() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const duration = 0.6; // 600ms woosh fits the staggered entrance perfectly
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; 
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    // Create a filter to sweep the frequencies (makes the "wooosh" shape)
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';

    const gain = audioCtx.createGain();

    // Connect the graph: Noise -> Filter -> Volume -> Output
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    // 1. Sweep the Filter (Muffled -> Bright -> Muffled)
    filter.frequency.setValueAtTime(100, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + duration / 2);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    // 2. Swell the Volume (Fade In -> Peak -> Fade Out)
    gain.gain.setValueAtTime(0.001, now); // Start silent
    gain.gain.exponentialRampToValueAtTime(0.15, now + (duration * 0.4)); // Swell up
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Fade out

    noise.start(now);
}
// --- JUICE: RIVALRY RECEIPT ---
window.triggerRivalryReceipt = function() {
    playCameraSnap();
    // 1. Sort the current items to find #1 and #2
    const sortedItems = Object.values(itemsData).map(item => ({
        name: item.name,
        total: item.votes + (pendingVotes[item.id] || 0),
        imageUrl: item.imageUrl
    })).sort((a, b) => b.total - a.total);

    // If we don't have at least 2 items, abort
    if (sortedItems.length < 2) return;

    const fighter1 = sortedItems[0];
    const fighter2 = sortedItems[1];
    const diff = fighter1.total - fighter2.total;

    // 2. Populate the Receipt UI
    document.getElementById('receipt-img-1').src = fighter1.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fighter1.name)}&background=FFD700&color=000&size=128&bold=true`;
    document.getElementById('receipt-name-1').innerText = fighter1.name;
    document.getElementById('receipt-votes-1').innerText = fighter1.total.toLocaleString();

    document.getElementById('receipt-img-2').src = fighter2.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(fighter2.name)}&background=ff0055&color=fff&size=128&bold=true`;
    document.getElementById('receipt-name-2').innerText = fighter2.name;
    document.getElementById('receipt-votes-2').innerText = fighter2.total.toLocaleString();

    document.getElementById('receipt-vote-diff').innerText = diff.toLocaleString();

    // 3. Show the Modal & Haptics
    document.getElementById('receipt-modal').classList.remove('hidden');
    if(navigator.vibrate) navigator.vibrate([100, 50, 200]);
};

window.closeReceipt = function() {
    document.getElementById('receipt-modal').classList.add('hidden');
};
// --- JUICE: AUTO-GENERATE & SHARE RECEIPT IMAGE ---
window.shareReceiptImage = async function() {
    playCameraSnap();
    const receiptCard = document.querySelector('.receipt-card');
    const shareBtn = document.getElementById('share-receipt-btn');
    const closeBtn = document.querySelector('.close-receipt');

    // 1. Hide the buttons temporarily so they don't show up in the picture
    shareBtn.style.display = 'none';
    closeBtn.style.display = 'none';

    try {
        // 2. Take a snapshot of the HTML card
        // useCORS is required so Wikipedia/UI-Avatar images load properly in the canvas
        const canvas = await html2canvas(receiptCard, { 
            backgroundColor: '#00121a',
            useCORS: true, 
            scale: 2 // High-res image
        });

        // 3. Convert canvas to a real image file
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], 'rank-riot-beef.png', { type: 'image/png' });

        // 4. Try to open the phone's native share drawer (iOS/Android)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                title: 'Rank Riot!',
                text: 'Look at this massive gap! 🔥',
                files: [file]
            });
        } else {
            // Fallback for Desktop/Unsupported Browsers: Download the image directly
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'rank-riot-beef.png';
            a.click();
        }
    } catch (err) {
        console.error("Failed to generate image:", err);
      
    }

    // 5. Put the buttons back!
    shareBtn.style.display = 'block';
    closeBtn.style.display = 'block';
};
function animateRankReorder(listEl, mutateDom) {
    const items = [...listEl.querySelectorAll('.list-item')];

    // First: record old positions
    const firstRects = new Map();
    items.forEach(el => {
        firstRects.set(el.id, el.getBoundingClientRect());
    });

    // Apply the DOM/order changes
    mutateDom();

    // Force layout
    listEl.offsetHeight;

    // Last: measure new positions, then invert
    items.forEach(el => {
        const first = firstRects.get(el.id);
        const last = el.getBoundingClientRect();
        if (!first || !last) return;

        const dx = first.left - last.left;
        const dy = first.top - last.top;

        if (dx || dy) {
            el.style.transition = 'none';
            el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;

            requestAnimationFrame(() => {
                el.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
                el.style.transform = '';
            });
        }
    });
}
function playCameraSnap() {
    if (audioCtx.state === 'suspended') audioCtx.resume();

    // 1. The mechanical "click" (Fast frequency drop)
    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    osc.type = 'square';
    osc.connect(oscGain);
    oscGain.connect(audioCtx.destination);

    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.05);
    
    oscGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);

    // 2. The shutter "shhh" (Burst of white noise)
    const bufferSize = audioCtx.sampleRate * 0.1; // 100ms of noise
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // Generate random static
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseGain = audioCtx.createGain();
    
    // Filter the noise to make it crisp and sharp, not rumbly
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    // Fade the noise out extremely fast
    noiseGain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

    noise.start();
}
// ==========================================
// MAD LIBS TICKER LOGIC (PLUG & PLAY VERSION)
// ==========================================

// 1. Give the user a random anonymous name
let rioterName = localStorage.getItem('rioterName');
if (!rioterName) {
    rioterName = "Rioter_" + Math.floor(Math.random() * 10000);
    localStorage.setItem('rioterName', rioterName);
}

// 2. Open Modal & Fill Dropdowns with the current Top 2 Fighters
document.getElementById('open-ticker-btn').addEventListener('click', () => {
    // Grab the items currently on the battlefield and sort them by rank
    const sortedItems = Array.from(document.querySelectorAll('.list-item'))
        .sort((a, b) => parseInt(a.style.order || 0) - parseInt(b.style.order || 0));
        
    // Extract the names of the top 2
    const f1Name = sortedItems[0] ? sortedItems[0].querySelector('.item-name').innerText : "Top Dog";
    const f2Name = sortedItems[1] ? sortedItems[1].querySelector('.item-name').innerText : "Underdog";

    // Inject them into the modal
    document.getElementById('madlib-subject').innerHTML = `<option value="${f1Name}">${f1Name}</option><option value="${f2Name}">${f2Name}</option>`;
    document.getElementById('madlib-target').innerHTML = `<option value="${f2Name}">${f2Name}</option><option value="${f1Name}">${f1Name}</option>`;
    
    document.getElementById('ticker-modal').style.display = 'flex';
});

// 3. Close Modal
document.getElementById('close-ticker-btn').addEventListener('click', () => {
    document.getElementById('ticker-modal').style.display = 'none';
});

// 4. Send the Message to Firebase
document.getElementById('send-ticker-btn').addEventListener('click', async () => {
    if (!currentCategory) return; // Failsafe to ensure we are actually looking at a list

    const subject = document.getElementById('madlib-subject').value;
    const action = document.getElementById('madlib-action').value;
    const target = document.getElementById('madlib-target').value;
    const finalMessage = `${subject} ${action} ${target} - ${rioterName}`;

    try {
        await addDoc(collection(db, "ticker_messages"), {
            listId: currentCategory,
            message: finalMessage,
            timestamp: serverTimestamp()
        });
        document.getElementById('ticker-modal').style.display = 'none';
        
        // --- NEW: RELOCK AFTER SENDING ---
        lockTickerButton();
        sessionVotes = 0; 
        
    } catch (e) {
        console.error("Error sending message:", e);
    }
});

// 5. Listen for New Messages & Fire Your Built-In Banner!
onSnapshot(query(collection(db, "ticker_messages"), orderBy("timestamp", "desc"), limit(1)), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
            const data = change.doc.data();
            
            // Ensure the message is for the current list, and isn't a stale message from yesterday
            const msgTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
            if (data.listId === currentCategory && Date.now() - msgTime < 10000) {
                // Pass 'true' to trigger the purple custom banner styling
fireGlobalBanner(`📢 ${data.message} 📢`, true);
            }
        }
    });
});

// ==========================================
// STORE NAVIGATION LOGIC
// ==========================================
const storeBtn = document.getElementById('global-store-btn');
const storeScreen = document.getElementById('store-screen');
const storeBackBtn = document.getElementById('store-back-btn');
const splashScreen = document.getElementById('splash-screen');
const categoryScreen = document.getElementById('category-screen');

let previousScreenBeforeStore = splashScreen; // Tracks where to go back to

// Open the Store
storeBtn.addEventListener('click', () => {
    // Figure out which screen we are currently on
    if (!splashScreen.classList.contains('hidden')) {
        previousScreenBeforeStore = splashScreen;
        splashScreen.classList.add('hidden');
    } else if (!categoryScreen.classList.contains('hidden')) {
        previousScreenBeforeStore = categoryScreen;
        categoryScreen.classList.add('hidden');
    }
    
    // Show store, hide the store button itself
    storeScreen.classList.remove('hidden');
    storeScreen.style.display = 'flex'; // Ensure flexbox layout works
    storeBtn.style.display = 'none'; 
});

// Close the Store (Go Back)
storeBackBtn.addEventListener('click', () => {
    storeScreen.classList.add('hidden');
    storeScreen.style.display = 'none';
    
    // Return to previous screen
    previousScreenBeforeStore.classList.remove('hidden');
    storeBtn.style.display = 'flex'; // Bring the store button back
});

// ==========================================
// STORE & CLICK EFFECT LOGIC
// ==========================================

// Track what the user actually owns/has equipped
let unlockedEffects = ['default'];
let equippedEffect = 'default'; 

// Track what the user is currently previewing in the store
let previewEffect = 'default';

const storeItems = document.querySelectorAll('.store-item');
const testPad = document.getElementById('store-test-pad');

// 1. Selecting an item to Preview
storeItems.forEach(item => {
    item.addEventListener('click', (e) => {
        // If they clicked the buy/equip button, ignore the preview selection
        if (e.target.tagName.toLowerCase() === 'button') return;

        // Reset all borders to their correct default colors
        storeItems.forEach(i => {
            const effectType = i.getAttribute('data-effect');
            if (effectType === 'shockwave') {
                i.style.borderColor = '#00e5ff'; // Restore Neon Cyan
            } else if (effectType === 'comic') {
                i.style.borderColor = '#ffcc00'; // Restore Comic Yellow
            } else {
                i.style.borderColor = '#333';    // Restore standard dark gray
            }
        });
        
        // Highlight the actively selected item in Riot Red
        item.style.borderColor = '#ff0044';
        previewEffect = item.getAttribute('data-effect');
    });
});

// 2. Tapping the Test Pad
testPad.addEventListener('click', (e) => {
    // If default is selected, do nothing (no effect)
    if (previewEffect === 'default') return;

    // Get click coordinates relative to the test pad
    const rect = testPad.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    spawnEffect(x, y, previewEffect, testPad);
    playPopSound(1, previewEffect);
});

// 3. The Function that spawns the visual
// 3. The Function that spawns the visual
function spawnEffect(x, y, effectType, container) {
    const fx = document.createElement('div');
    fx.style.left = `${x}px`;
    fx.style.top = `${y}px`;

    // Standard Emoji Effects
    if (effectType === 'fire' || effectType === 'toxic') {
        fx.classList.add('click-fx');
        if (effectType === 'fire') fx.innerText = '🔥';
        if (effectType === 'toxic') {
            fx.innerText = '☣️';
            fx.style.color = '#00ff00';
        }
    } 
    // Premium Effect: Shockwave
    else if (effectType === 'shockwave') {
        fx.classList.add('fx-shockwave');
    } 
    // Premium Effect: Comic Strike
    else if (effectType === 'comic') {
        fx.classList.add('fx-comic');
        
        // Pick a random word
        const words = ['BAM!', 'POW!', 'SMASH!', 'WHACK!', 'BOOM!'];
        const word = words[Math.floor(Math.random() * words.length)];
        
        // Give it a random tilt between -25 and +25 degrees
        const tilt = Math.floor(Math.random() * 50) - 25;
        
        // We wrap the word in a span to apply the tilt without messing up the CSS animation
        fx.innerHTML = `<span style="display: block; transform: rotate(${tilt}deg);">${word}</span>`;
    }

    container.appendChild(fx);

    // Clean up DOM after animation finishes
    setTimeout(() => {
        if(fx.parentNode === container) fx.remove();
    }, 600);
}

// 4. Buy & Equip Logic
document.querySelectorAll('.store-item button').forEach(btn => {
    // Make sure all buttons can be clicked initially (except the one already equipped)
    if (btn.innerText !== 'EQUIPPED') {
        btn.style.pointerEvents = 'auto';
    }

    btn.addEventListener('click', (e) => {
        const item = e.target.closest('.store-item');
        const effectId = item.getAttribute('data-effect');
        
        // 1. If they don't own it yet, process the "buy"
        if (!unlockedEffects.includes(effectId)) {
            alert("Normally this triggers Apple/Google Pay. We will unlock it for now!");
            unlockedEffects.push(effectId);
        }
        
        // 2. Equip the item
        equippedEffect = effectId;
        
        // 3. Reset ALL buttons in the store to "EQUIP" if they own them
        document.querySelectorAll('.store-item').forEach(storeItem => {
            const thisEffectId = storeItem.getAttribute('data-effect');
            const thisBtn = storeItem.querySelector('button');
            
            if (unlockedEffects.includes(thisEffectId)) {
                thisBtn.innerText = 'EQUIP';
                thisBtn.style.background = '#333';
                thisBtn.style.color = 'white';
                thisBtn.style.pointerEvents = 'auto'; // Make it clickable again
                thisBtn.style.cursor = 'pointer';
            }
        });
        
        // 4. Highlight the newly equipped button
        e.target.innerText = 'EQUIPPED';
        e.target.style.background = 'transparent';
        e.target.style.color = '#ff0044';
        e.target.style.pointerEvents = 'none'; // Can't equip what's already equipped
    });
});

// 1. Setup the Background Music
const bgm = new Audio('assets/bgmusic.mp3'); // UPDATE THIS PATH!
bgm.loop = true; // Crucial: loops forever
bgm.volume = 0.2; // Set to 60% so it doesn't drown out your tap SFX

// 2. The Mute Button Logic
const muteBtn = document.getElementById('mute-btn');
let isMuted = false;

muteBtn.addEventListener('click', (e) => {
    // Stop the click from triggering the "first tap" logic underneath
    e.stopPropagation(); 
    
    isMuted = !isMuted;
    bgm.muted = isMuted;
    
    // Toggle the icon visually
    if (isMuted) {
        muteBtn.innerText = '🔇';
        muteBtn.style.borderColor = '#555';
        muteBtn.style.boxShadow = 'none'; // Kill the neon glow when muted
    } else {
        muteBtn.innerText = '🔊';
        muteBtn.style.borderColor = '#00e5ff';
        muteBtn.style.boxShadow = '0 0 10px #00e5ff'; // Turn the neon back on
        
        // If they unmuted but the audio never started, start it now
        if (bgm.paused) {
            bgm.play().catch(err => console.log("Audio play blocked by browser:", err));
        }
    }
});

// 3. The "First Tap" Autoplay Unlocker
// This listens for the very first time the user touches the screen, starts the music, then destroys itself.
const startAudio = () => {
    if (!isMuted && bgm.paused) {
        bgm.play().catch(err => console.log("Waiting for user interaction:", err));
    }
    // Remove the listener so it doesn't try to fire this command on every single mash
    document.removeEventListener('pointerdown', startAudio);
};

// Listen for a touch anywhere on the screen
document.addEventListener('pointerdown', startAudio);