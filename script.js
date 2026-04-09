import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, updateDoc, increment, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

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

function fireGlobalBanner(message) {
    globalTickerText.innerText = message;
    globalTickerContainer.classList.remove('hidden');
    
    // Restart the CSS animation
    globalTickerText.style.animation = 'none';
    void globalTickerText.offsetWidth; // Trigger reflow
    globalTickerText.style.animation = 'rushAcross 4s linear forwards';

    // Huge haptic feedback for massive events
    if(navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);

    // Hide it after it scrolls past
    setTimeout(() => {
        globalTickerContainer.classList.add('hidden');
    }, 4500);
}
function playPopSound(multiplier) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Fever mode = higher pitch pop!
    const baseFreq = multiplier >= 10 ? 800 : (multiplier > 1 ? 500 : 300);
    
    osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
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
}

// --- Navigation Events ---
document.getElementById('play-btn').addEventListener('click', () => {
    // Add a satisfying click feel even to entry
    if(navigator.vibrate) navigator.vibrate([30, 10, 30]);
    showScreen('category');
    
    // START PRELOADING WHILE THEY CHOOSE A CATEGORY
    preloadCategoryImages(); 
});

document.getElementById('back-btn').addEventListener('click', () => {
    if (activeListener) activeListener(); // Stop listening to Firebase
    showScreen('category');
    currentCategory = null;
    rankingList.innerHTML = ''; // Clear DOM
});

// Category Selection
document.querySelectorAll('.cat-card').forEach(card => {
    card.addEventListener('click', (e) => {
        // Handle clicking parent or child elements
        const target = e.currentTarget;
        currentCategory = target.getAttribute('data-list');
        const name = target.querySelector('.cat-name').innerText;
        currentListTitle.innerText = name;
        showScreen('game');
        loadBattlefield(currentCategory);
    });
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
const FIRE_THRESHOLD = 50; // Clicks required to ignite

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

        updatedItems.forEach((item, index) => {
            itemsData[item.id] = item;
            
            // 3. Create DOM if needed
            let itemEl = document.getElementById(`item-${item.id}`);
            if (!itemEl) {
                // THE FIX: We are finally passing item.imageUrl here!
                itemEl = createItemElement(item.id, item.name, item.imageUrl);
                rankingList.appendChild(itemEl);
            }
            
            // 4. JUICY: Smooth reordering
            itemEl.style.order = index;
            itemEl.querySelector('.rank-number').innerText = (index + 1);
            
            // Special styling for Top 3
            if(index === 0) {
                // ADD THE JUICE
                itemEl.classList.add('rank-one');
                itemEl.style.borderColor = 'transparent'; // Let CSS handle the borders now
            } else {
                // REMOVE THE JUICE IF THEY LOSE 1ST PLACE
                itemEl.classList.remove('rank-one');
                
                if (index === 1) itemEl.style.borderColor = '#C0C0C0'; // Silver
                else if (index === 2) itemEl.style.borderColor = '#CD7F32'; // Bronze
                else itemEl.style.borderColor = 'transparent'; // Normal
            }

            // 5. Update votes
            const localBuffer = pendingVotes[item.id] || 0;
            itemEl.querySelector('.item-votes').innerText = (item.votes + localBuffer).toLocaleString() + ' VOTES';
        });
    });
}

// --- Dynamic DOM Creation ---
function createItemElement(id, name, imageUrl) {
    const div = document.createElement('div');
    div.classList.add('list-item');
    div.id = `item-${id}`; 
    
    // Fallback ONLY if imageUrl is genuinely missing
    const safeImage = imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff0055&color=fff&size=128&bold=true`;

    div.innerHTML = `
        <div class="rank-number"></div>
        <img class="item-pic" src="${safeImage}" alt="${name}" draggable="false" />
        <div class="item-info">
            <h3 class="item-name">${name}</h3>
            <p class="item-votes">0 VOTES</p>
        </div>
        <div class="mash-btn-wrapper">
            <button class="mash-btn">MASH!</button>
        </div>
    `;
    
    const btn = div.querySelector('.mash-btn');
    btn.addEventListener('pointerdown', (e) => handleMash(id, e));
    return div;
}
function handleMash(id, e) {
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
    updateCombo();
    
    // --- THE ON FIRE SPLASH DAMAGE ---
    if (isOnFire) {
        // Find the person right below them in the rankings
        const sortedItems = Object.values(itemsData).sort((a, b) => b.votes - a.votes);
        const myIndex = sortedItems.findIndex(item => item.id === id);
        
        // If there is someone below us, steal a vote from them!
        if (myIndex >= 0 && myIndex < sortedItems.length - 1) {
            const victimId = sortedItems[myIndex + 1].id;
            
            // Subtract 1 from pending votes
            if (!pendingVotes[victimId]) pendingVotes[victimId] = 0;
            pendingVotes[victimId] -= 1; 
            
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
 // --- NEW: THE MILESTONE MATH ---
    const currentBase = itemsData[id] ? itemsData[id].votes : 0;
    const oldTotal = currentBase + (pendingVotes[id] || 0); // Score before this click

    // 2. Optimistic UI Update
    if (!pendingVotes[id]) pendingVotes[id] = 0;
    pendingVotes[id] += multiplier;
    
    const newTotal = currentBase + pendingVotes[id]; // Score after this click

    // Update display text immediately
    const voteDisplay = document.querySelector(`#item-${id} .item-votes`);
    voteDisplay.innerText = newTotal.toLocaleString() + ' VOTES';

    // --- CHECK FOR MILESTONE NUKE (Every 100 votes) ---
    // Change the 100 to 1000 or 10000 when your app gets huge!
    if (Math.floor(oldTotal / 100) < Math.floor(newTotal / 100)) {
        triggerMilestoneNuke(itemsData[id].name, newTotal);
    }

   // 3. VISUAL JUICE
    createFloatingText(event.clientX, event.clientY, `+${multiplier}`);
    playPopSound(multiplier);

    // OPTIMIZATION: Fix Layout Thrashing on the animation reset
    const cardEl = document.getElementById(`item-${id}`);
    cardEl.classList.remove('flash-hit');
    
    // Instead of forcing a synchronous reflow (void cardEl.offsetWidth), 
    // we use double requestAnimationFrame to let the browser breathe.
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            cardEl.classList.add('flash-hit');
        });
    });
    
    // Mobile Haptics
    if (navigator.vibrate) {
        if(multiplier === 10) navigator.vibrate(25);
        else navigator.vibrate(10); 
    }

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
    });

    // 4. Reset Clash visuals ONLY if something moved
    if (ranksShifted || document.querySelector('.clashing')) {
        document.querySelectorAll('.list-item').forEach(el => el.classList.remove('clashing'));
        rankingList.classList.remove('list-dimmed');
    }

    // 5. DID WE OVERTAKE?
    if (newRank < oldRank) {
        let winnerName = itemsData[id].name;
        let loserName = itemsArray[newRank + 1].name;
        
        triggerOvertakeEffect(winnerName, loserName);
        
        setDoc(doc(db, "global", "latest_event"), {
            winner: winnerName,
            loser: loserName,
            timestamp: Date.now()
        });
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
    // 40 clicks fast sets off Fever mode
    let barPercentage = Math.min((comboClicks / 40) * 100, 100);
    comboBarFill.style.width = `${barPercentage}%`;

    if (comboClicks >= 40) {
        multiplier = 10;
        comboText.innerText = "🔥 10x FEVER RIOT! 🔥";
        comboText.style.color = getCssVar('--riot-pink');
        comboBarFill.style.background = getCssVar('--riot-pink');
        body.classList.add('shake', 'fever-pulse');
    } else if (comboClicks >= 15) {
        multiplier = 2;
        comboText.innerText = "2x MULTIPLIER";
        comboText.style.color = getCssVar('--riot-blue');
    }

    // Drop combo if no clicks for 0.8s
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
window.seedDatabase = async function() {
    console.log("🧹 Sweeping ALL databases clean...");

    // The Master Data Object containing all 5 categories
    const allCategories = {
        
        // 1. PRESIDENTS (Preserved your links!)
        presidents: [
            { id: "biden", name: "Joe Biden", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Joe_Biden_presidential_portrait_%28cropped%29.jpg" },
            { id: "trump", name: "Donald Trump", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Official_Presidential_Portrait_of_President_Donald_J._Trump_%282025%29.jpg" },
            { id: "obama", name: "Barack Obama", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8d/President_Barack_Obama.jpg" },
            { id: "bush43", name: "George W. Bush", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/8/84/George-W-Bush_%28cropped_2%29.jpeg" },
            { id: "clinton", name: "Bill Clinton", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d3/Bill_Clinton.jpg" },
            { id: "bush41", name: "George H.W. Bush", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ee/George_H._W._Bush_presidential_portrait_%28cropped%29.jpg" },
            { id: "reagan", name: "Ronald Reagan", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Official_Portrait_of_President_Reagan_1981.jpg" },
            { id: "carter", name: "Jimmy Carter", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5a/JimmyCarterPortrait2.jpg" },
            { id: "ford", name: "Gerald Ford", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Gerald_Ford_presidential_portrait_%28cropped%29.jpg" },
            { id: "nixon", name: "Richard Nixon", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Richard_Nixon_presidential_portrait.jpg" },
            { id: "lbj", name: "Lyndon B. Johnson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/37_Lyndon_Johnson_3x4.jpg" },
            { id: "jfk", name: "John F. Kennedy", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/John_F._Kennedy%2C_White_House_color_photo_portrait.jpg" },
            { id: "ike", name: "Dwight D. Eisenhower", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/6/63/Dwight_D._Eisenhower%2C_official_photo_portrait%2C_May_29%2C_1959.jpg" },
            { id: "truman", name: "Harry S. Truman", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0b/TRUMAN_58-766-06_%28cropped%29.jpg" },
            { id: "fdr", name: "Franklin D. Roosevelt", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b8/FDR_in_1933.jpg" },
            { id: "hoover", name: "Herbert Hoover", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/HerbertHoover.jpg" },
            { id: "coolidge", name: "Calvin Coolidge", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Calvin_Coolidge_cph.3g10777_%28cropped%29.jpg" },
            { id: "harding", name: "Warren G. Harding", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c4/Warren_G_Harding-Harris_%26_Ewing.jpg" },
            { id: "wilson", name: "Woodrow Wilson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/53/Thomas_Woodrow_Wilson%2C_Harris_%26_Ewing_bw_photo_portrait%2C_1919.jpg" },
            { id: "taft", name: "William Howard Taft", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Cabinet_card_of_William_Howard_Taft_by_Pach_Brothers_-_Cropped_to_image.jpg" },
            { id: "teddy", name: "Theodore Roosevelt", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Theodore_Roosevelt_by_the_Pach_Bros.jpg" },
            { id: "mckinley", name: "William McKinley", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f6/William_mckinley.jpg" },
            { id: "cleveland", name: "Grover Cleveland", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Grover_Cleveland_-_NARA_-_518139_%28cropped%29.jpg" },
            { id: "harrison_b", name: "Benjamin Harrison", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Pach_Brothers_-_Benjamin_Harrison.jpg" },
            { id: "arthur", name: "Chester A. Arthur", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/79/Chester_Alan_Arthur.jpg" },
            { id: "garfield", name: "James A. Garfield", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1f/James_Abram_Garfield%2C_photo_portrait_seated.jpg" },
            { id: "hayes", name: "Rutherford B. Hayes", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/President_Rutherford_Hayes_1870_-_1880_Restored.jpg" },
            { id: "grant", name: "Ulysses S. Grant", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/75/Ulysses_S_Grant_by_Brady_c1870-restored.jpg" },
            { id: "johnson_a", name: "Andrew Johnson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ce/President_Andrew_Johnson.jpg" },
            { id: "lincoln", name: "Abraham Lincoln", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Abraham_Lincoln_O-77_matte_collodion_print.jpg" },
            { id: "buchanan", name: "James Buchanan", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fd/James_Buchanan.jpg" },
            { id: "pierce", name: "Franklin Pierce", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/29/Franklin_Pierce.jpg" },
            { id: "fillmore", name: "Millard Fillmore", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Millard_Fillmore.jpg" },
            { id: "taylor", name: "Zachary Taylor", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/51/Zachary_Taylor_restored_and_cropped.jpg" },
            { id: "polk", name: "James K. Polk", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/JKP.jpg" },
            { id: "tyler", name: "John Tyler", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/John_Tyler%2C_Jr.jpg" },
            { id: "harrison_w", name: "William Henry Harrison", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/William_Henry_Harrison_daguerreotype_edit.jpg" },
            { id: "vanburen", name: "Martin Van Buren", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/9/94/Martin_Van_Buren_edit.jpg" },
            { id: "jackson", name: "Andrew Jackson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/4/43/Andrew_jackson_head.jpg" },
            { id: "adams_jq", name: "John Quincy Adams", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/John_Q._Adams-edit.jpg" },
            { id: "monroe", name: "James Monroe", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/James_Monroe_White_House_portrait_1819.jpg" },
            { id: "madison", name: "James Madison", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1d/James_Madison.jpg" },
            { id: "jefferson", name: "Thomas Jefferson", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/0/07/Official_Presidential_portrait_of_Thomas_Jefferson_%28by_Rembrandt_Peale%2C_1800%29.jpg" },
            { id: "adams_j", name: "John Adams", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/Gilbert_Stuart%2C_John_Adams%2C_c._1800-1815%2C_NGA_42933.jpg" },
            { id: "washington", name: "George Washington", votes: 0, imageUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Gilbert_Stuart_Williamstown_Portrait_of_George_Washington.jpg" }
        ],

        // 2. SPIDER-MAN MOVIES
        spiderman: [
            { id: "sm_2002", name: "Spider-Man (2002)", votes: 0, imageUrl: "https://m.media-amazon.com/images/M/MV5BMmNhMjY4MGYtYjBkMC00NjMxLThmNmUtMGZjNGY1MWRmNDU0XkEyXkFqcGc@._V1_.jpg" },
            { id: "sm_2", name: "Spider-Man 2", votes: 0, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.qUTI37l9u4W0Is3IeKwNtAHaJQ?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "sm_3", name: "Spider-Man 3", votes: 0, imageUrl: "https://tse2.mm.bing.net/th/id/OIP.i1Fu2RdGB7CsAzueetWUdQHaKm?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "asm_1", name: "The Amazing Spider-Man", votes: 0, imageUrl: "https://pics.filmaffinity.com/the_amazing_spider_man_the_amazing_spiderman-672391099-large.jpg" },
            { id: "asm_2", name: "The Amazing Spider-Man 2", votes: 0, imageUrl: "https://www.scannain.com/media/the-amazing-spider-man-2_intl-poster2.jpg" },
            { id: "hc", name: "Spider-Man: Homecoming", votes: 0, imageUrl: "https://tse2.mm.bing.net/th/id/OIP.zGSI702QZFgb8-X_eTjO5AHaLH?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "ffh", name: "Spider-Man: Far From Home", votes: 0, imageUrl: "https://tse1.mm.bing.net/th/id/OIP.i1aIGenvmekZMMrQKu1zywHaLH?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "nwh", name: "Spider-Man: No Way Home", votes: 0, imageUrl: "https://tse4.mm.bing.net/th/id/OIP.tHX3xsb4XLGRJ5FzC9IZdQHaK-?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "sv_1", name: "Into the Spider-Verse", votes: 0, imageUrl: "https://image.tmdb.org/t/p/w1280/9LuL3pwJiwIWSckeCbOX8G12F4X.jpg" },
            { id: "sv_2", name: "Across the Spider-Verse", votes: 0, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.HGuuJ_JlSJFz8aOT7TOyxwHaK-?rs=1&pid=ImgDetMain&o=7&rm=3" }
        ],

        // 3. FAST FOOD KINGS
        fastfood: [
            { id: "mcd", name: "McDonald's", votes: 0, imageUrl: "https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/ccfca04c-6fa9-4a68-9bc7-134bfd5c5650/dfr1edm-c2d05053-3179-4879-8d34-95c7608303bd.jpg/v1/fill/w_1280,h_896,q_75,strp/mcdonald_s_logo_by_fanta_shokata_by_fantaschokata_dfr1edm-fullview.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7ImhlaWdodCI6Ijw9ODk2IiwicGF0aCI6IlwvZlwvY2NmY2EwNGMtNmZhOS00YTY4LTliYzctMTM0YmZkNWM1NjUwXC9kZnIxZWRtLWMyZDA1MDUzLTMxNzktNDg3OS04ZDM0LTk1Yzc2MDgzMDNiZC5qcGciLCJ3aWR0aCI6Ijw9MTI4MCJ9XV0sImF1ZCI6WyJ1cm46c2VydmljZTppbWFnZS5vcGVyYXRpb25zIl19.d74AGaqdDxXMFPLEIs7Wd9Y_jxCtSbl0rveC4_T7Ksk" },
            { id: "wendys", name: "Wendy's", votes: 0, imageUrl: "https://www.pngmart.com/files/23/Wendys-Logo-PNG-HD.png" },
            { id: "bk", name: "Burger King", votes: 0, imageUrl: "https://purepng.com/public/uploads/large/burger-king-logo-xua.png" },
            { id: "taco", name: "Taco Bell", votes: 0, imageUrl: "https://th.bing.com/th/id/R.a89f9d0d9872aa99f8f34b43de91f39d?rik=xSaqvW5ijS1eXA&riu=http%3a%2f%2fcdn.mos.cms.futurecdn.net%2fhgRu36yguybcDeZLsZybEA.jpg&ehk=tQSZ%2fd8i6qFyinJIuEyhXDjtXvswJubOQAcDLc4zNg4%3d&risl=&pid=ImgRaw&r=0" },
            { id: "kfc", name: "KFC", votes: 0, imageUrl: "https://1000logos.net/wp-content/uploads/2019/07/KFC-logo-2018.jpg" },
            { id: "popeyes", name: "Popeyes", votes: 0, imageUrl: "https://tse2.mm.bing.net/th/id/OIP.ymQ8vpITAK9aKzf1WifpsAHaHZ?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "cfa", name: "Chick-fil-A", votes: 0, imageUrl: "https://mma.prnewswire.com/media/181277/chick_fil_a__inc__logo.jpg?p=facebook" },
            { id: "chipotle", name: "Chipotle", votes: 0, imageUrl: "https://tse1.mm.bing.net/th/id/OIP.UNfUqpvG8mksXexVBjt6owHaHa?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "subway", name: "Subway", votes: 0, imageUrl: "https://logos-world.net/wp-content/uploads/2023/01/Subway-Emblem.png" },
            { id: "innout", name: "In-N-Out Burger", votes: 0, imageUrl: "https://th.bing.com/th/id/R.ec8e1f17505126f1b5c79bf6c3269fb5?rik=Vist%2fnci1K0J6w&pid=ImgRaw&r=0" },
            { id: "sonic", name: "Sonic Drive-In", votes: 0, imageUrl: "https://logodix.com/logo/889388.jpg" },
            { id: "arbys", name: "Arby's", votes: 0, imageUrl: "https://blog.logomyway.com/wp-content/uploads/2021/07/arbys-logo-PNG-1536x1286.jpg" }
        ],

        // 4. GOAT RAPPERS
        rappers: [
            { id: "kendrick", name: "Kendrick Lamar", votes: 0, imageUrl: "https://allaboutginger.com/wp-content/uploads/2024/05/Untitled-design-1.png" },
            { id: "drake", name: "Drake", votes: 0, imageUrl: "https://static01.nyt.com/images/2021/12/08/arts/06drake2/06drake2-mediumSquareAt3X.jpg" },
            { id: "cole", name: "J. Cole", votes: 0, imageUrl: "https://media.gq.com/photos/63c8d5a6cd63aa9138b13c7b/16:9/w_2560%2Cc_limit/1246142881" },
            { id: "eminem", name: "Eminem", votes: 0, imageUrl: "https://facts.net/wp-content/uploads/2023/07/31-facts-about-eminem-1690006118.jpg" },
            { id: "jayz", name: "Jay-Z", votes: 0, imageUrl: "https://media.cnn.com/api/v1/images/stellar/prod/gettyimages-1911124317.jpg?c=16x9&q=h_833,w_1480,c_fill" },
            { id: "nas", name: "Nas", votes: 0, imageUrl: "https://m.media-amazon.com/images/M/MV5BMjExNTE1OTA0Nl5BMl5BanBnXkFtZTcwMTkwNTk0Mg@@._V1_FMjpg_UX1000_.jpg" },
            { id: "tupac", name: "Tupac Shakur", votes: 0, imageUrl: "https://cdn.britannica.com/02/162002-050-02512608/Tupac-Shakur-1993.jpg" },
            { id: "biggie", name: "The Notorious B.I.G.", votes: 0, imageUrl: "https://th.bing.com/th/id/R.885804c59fec76a7f145392c17c5deb9?rik=l82okCvFg%2b6Q4Q&pid=ImgRaw&r=0" },
            { id: "kanye", name: "Kanye West", votes: 0, imageUrl: "https://tse1.mm.bing.net/th/id/OIP.4Pe3JEf8UcfLALZG6GFsEQHaHZ?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "wayne", name: "Lil Wayne", votes: 0, imageUrl: "https://tse1.explicit.bing.net/th/id/OIP.DO4LyJC8Dy3Y-7TKLrE_IQHaHa?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "snoop", name: "Snoop Dogg", votes: 0, imageUrl: "https://static.independent.co.uk/2022/02/08/15/Super_Bowl_Snoop_Dogg_23045.jpg?quality=75&width=1200&auto=webp" },
            { id: "nicki", name: "Nicki Minaj", votes: 0, imageUrl: "https://www.shefinds.com/files/2023/11/Nicki-Minaj-pink-hair-VMA.jpg" }
        ],

        // 5. ELITE TV SHOWS
        shows: [
            { id: "bb", name: "Breaking Bad", votes: 0, imageUrl: "https://tse3.mm.bing.net/th/id/OIP.e4JnjmBipimGbevR21juBAHaHa?rs=1&pid=ImgDetMain&o=7&rm=3" },
            { id: "got", name: "Game of Thrones", votes: 0, imageUrl: "https://www.estrelando.com.br/uploads/2021/04/08/game-of-throne-trailer-1617908969.jpg" },
            { id: "office", name: "The Office", votes: 0, imageUrl: "https://static1.srcdn.com/wordpress/wp-content/uploads/2023/03/the-office-poster-michael-scott.jpg" },
            { id: "sopranos", name: "The Sopranos", votes: 0, imageUrl: "https://images-na.ssl-images-amazon.com/images/S/pv-target-images/80aebebe092e4a10b239e96d85f79e50d8d9bf0212c674b4a6fc85b58e7e309e._RI_TTW_.jpg" },
            { id: "wire", name: "The Wire", votes: 0, imageUrl: "https://m.media-amazon.com/images/S/pv-target-images/513ff06af1d1f20148f2cd42ad5a373bb984799c059a0c5060bb6f888ecb257b.jpg" },
            { id: "stranger", name: "Stranger Things", votes: 0, imageUrl: "https://th.bing.com/th/id/R.a4d953164c6d3c3f174cac35deaa8d25?rik=IfEQFIpC36Zx0w&riu=http%3a%2f%2fwww.slashfilm.com%2fwp%2fwp-content%2fimages%2fstranger-things-1.jpg&ehk=4Ze%2bL3r5gM%2b7GgdQywfHdjFI%2fUJPBMgU6fBiFVFUwwo%3d&risl=1&pid=ImgRaw&r=0" },
            { id: "succession", name: "Succession", votes: 0, imageUrl: "https://www.comingsoon.net/wp-content/uploads/sites/3/2023/03/FrrYXjLaAAA_604.jpeg?w=819" },
            { id: "friends", name: "Friends", votes: 0, imageUrl: "https://m.media-amazon.com/images/S/pv-target-images/c7fc75a423fc33698265a27fe446a41026f3c8642fd6c8706c43b897d2ffb3e6.jpg" },
            { id: "avatar", name: "Avatar: The Last Airbender", votes: 0, imageUrl: "https://media.themoviedb.org/t/p/w780/kU98MbVVgi72wzceyrEbClZmMFe.jpg" },
            { id: "bcs", name: "Better Call Saul", votes: 0, imageUrl: "https://cdn.firstcuriosity.com/wp-content/uploads/2025/07/14195356/Better-Call-Saul.jpg" },
            { id: "seinfeld", name: "Seinfeld", votes: 0, imageUrl: "https://cdn.britannica.com/09/189409-050-01172C19/Cast-Jason-Alexander-Seinfeld-Michael-Richards.jpg" }
        ]
    };

    // Loop through every category and wipe/seed them one by one
    for (const [categoryName, itemsArray] of Object.entries(allCategories)) {
        console.log(`⏳ Processing category: ${categoryName}...`);
        
        // 1. BURN IT DOWN
        const listRef = collection(db, `lists/${categoryName}/items`);
        const snapshot = await getDocs(listRef);
        const deletePromises = [];
        
        snapshot.forEach(docSnap => {
            deletePromises.push(deleteDoc(doc(db, `lists/${categoryName}/items`, docSnap.id)));
        });
        await Promise.all(deletePromises);

        // 2. SEED IT WITH NEW DATA
        for (const item of itemsArray) {
            const itemRef = doc(db, `lists/${categoryName}/items`, item.id);
            await setDoc(itemRef, {
                name: item.name,
                votes: item.votes,
                imageUrl: item.imageUrl 
            });
        }
    }

    console.log("✅ DONE! All 5 databases are fresh and seeded. Refresh the page.");
};

function triggerOvertakeEffect(winnerName, loserName) {
    if (document.querySelector('.overtake-banner')) return; 

    const banner = document.createElement('div');
    banner.classList.add('overtake-banner');
    
    // CRITICAL FIX 1: Add pointer-events: none to children 
    // so the pointer always targets the banner div itself.
    banner.innerHTML = `
        <h1 style="pointer-events: none;">💥 OVERTAKEN! 💥</h1>
        <p style="pointer-events: none;">${winnerName} crushed ${loserName}!</p>
    `;

    // CRITICAL FIX 2: Force layering and interaction via JS
    banner.style.pointerEvents = 'auto'; // Overrides any CSS blocking interaction
    banner.style.zIndex = '9999'; // Forces it above all other game layers
    banner.style.touchAction = 'none'; 
    banner.style.userSelect = 'none';
    banner.style.webkitUserSelect = 'none';
    banner.style.willChange = 'transform, opacity'; 

    document.body.appendChild(banner);

    if (navigator.vibrate) navigator.vibrate([50, 50, 100]); 

    let autoRemoveTimer = setTimeout(() => {
        if (banner.parentNode) banner.remove();
    }, 1500);

    let startX = 0;
    let currentTranslate = 0;
    let isDragging = false;

    banner.addEventListener('pointerdown', (e) => {
        isDragging = true;
        startX = e.clientX; 
        currentTranslate = 0; 
        
        banner.style.transition = 'none'; 
        clearTimeout(autoRemoveTimer);
        
        // CRITICAL FIX 3: Safely capture the pointer on the explicit target
        e.target.setPointerCapture(e.pointerId); 
    });

    banner.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        
        currentTranslate = e.clientX - startX;
        
        banner.style.transform = `translate(calc(-50% + ${currentTranslate}px), -50%)`;
        banner.style.opacity = 1 - (Math.abs(currentTranslate) / window.innerWidth);
    });

    const handleRelease = (e) => {
        if (!isDragging) return;
        isDragging = false;

        // Release the pointer cleanly
        if (e.target.hasPointerCapture && e.target.hasPointerCapture(e.pointerId)) {
            e.target.releasePointerCapture(e.pointerId);
        }

        banner.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';

        if (Math.abs(currentTranslate) > 75) {
            // Yeet it
            const flyAwayDistance = currentTranslate > 0 ? window.innerWidth : -window.innerWidth;
            banner.style.transform = `translate(calc(-50% + ${flyAwayDistance}px), -50%)`;
            banner.style.opacity = '0';
            
            setTimeout(() => {
                if (banner.parentNode) banner.remove();
            }, 300);
            
            if (navigator.vibrate) navigator.vibrate(20); 
            
        } else {
            // Snap it back to dead center
            banner.style.transform = 'translate(-50%, -50%)';
            banner.style.opacity = '1';
            
            autoRemoveTimer = setTimeout(() => {
                if (banner.parentNode) banner.remove();
            }, 1500);
        }
    };

    banner.addEventListener('pointerup', handleRelease);
    banner.addEventListener('pointercancel', handleRelease);
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
            alert("🔥 Link copied to clipboard! Paste it in the group chat!");
        }
    } catch (err) {
        console.log('Share canceled or failed:', err);
    }
};
// --- JUICE: RIVALRY RECEIPT ---
window.triggerRivalryReceipt = function() {
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
        alert("Couldn't generate image directly. Just take a screenshot!");
    }

    // 5. Put the buttons back!
    shareBtn.style.display = 'block';
    closeBtn.style.display = 'block';
};
