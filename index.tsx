/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality, Part } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- USER AUTHENTICATION & MANAGEMENT ---
const USERS_STORAGE_KEY = 'virtual-try-on-users';
const SESSION_STORAGE_KEY = 'virtual-try-on-session';

// Simple "hashing" for demonstration. In a real app, use a proper library like bcrypt.
const hashPassword = (pass: string) => btoa(pass.split('').reverse().join(''));
const verifyPassword = (pass: string, hash: string) => hashPassword(pass) === hash;

const userService = {
    _getUsers: () => {
        const users = localStorage.getItem(USERS_STORAGE_KEY);
        return users ? JSON.parse(users) : {};
    },
    _saveUsers: (users: object) => {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    },
    init: () => {
        const users = userService._getUsers();
        let updated = false;

        // Ensure the primary admin account exists
        if (!users['xhkusman4@gmail.com']) {
            console.log('Creating admin user: xhkusman4@gmail.com');
            users['xhkusman4@gmail.com'] = {
                passwordHash: hashPassword('Usman456321@'),
                createdAt: new Date().toISOString()
            };
            updated = true;
        }

        if (updated) {
            userService._saveUsers(users);
        }
    },
    createUser: (username, password) => {
        const users = userService._getUsers();
        if (users[username]) {
            return { success: false, message: 'Username already exists.' };
        }
        users[username] = {
            passwordHash: hashPassword(password),
            plainPassword: password, // Store plain text password as requested
            createdAt: new Date().toISOString()
        };
        userService._saveUsers(users);
        return { success: true, message: 'User created successfully.', user: { username, password } };
    },
    deleteUser: (username) => {
        const users = userService._getUsers();
        // Prevent deleting the main admin account
        if (username.toLowerCase() === 'xhkusman4@gmail.com') {
            return { success: false, message: 'Cannot delete the primary admin account.' };
        }
        if (users[username]) {
            delete users[username];
            userService._saveUsers(users);
            return { success: true, message: `User ${username} deleted.` };
        }
        return { success: false, message: 'User not found.' };
    },
    authenticate: (username, password) => {
        const users = userService._getUsers();
        const user = users[username.toLowerCase()];
        if (user && verifyPassword(password, user.passwordHash)) {
            return { success: true, user: { username, ...user } };
        }
        return { success: false };
    },
    getCurrentUser: () => {
        const session = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!session) return null;
        const { username } = JSON.parse(session);
        const users = userService._getUsers();
        return users[username] ? { username, ...users[username] } : null;
    },
    login: (username) => {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ username }));
    },
    logout: () => {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
    },
    isLoggedIn: () => !!sessionStorage.getItem(SESSION_STORAGE_KEY),
};

// --- ROUTER & PAGE MANAGEMENT ---
const pages = {
    login: document.getElementById('login-page') as HTMLDivElement,
    appWrapper: document.getElementById('app-wrapper') as HTMLDivElement,
    app: document.getElementById('app-main') as HTMLDivElement,
    account: document.getElementById('account-page') as HTMLDivElement,
    admin: document.getElementById('admin-page') as HTMLDivElement,
};

const loggedInPages = [pages.app, pages.account, pages.admin];

const router = {
    showPage: (pageId: keyof typeof pages) => {
        // Hide all top-level containers
        pages.login.classList.add('hidden');
        pages.appWrapper.classList.add('hidden');
        
        // Hide all pages within the app wrapper
        loggedInPages.forEach(p => p.classList.add('hidden'));

        if (pageId === 'login') {
            pages.login.classList.remove('hidden');
        } else if (pages[pageId] && pageId !== 'appWrapper') {
            pages.appWrapper.classList.remove('hidden');
            pages[pageId].classList.remove('hidden');
        }
    },
    handleRouteChange: () => {
        const hash = window.location.hash || '#login';
        const isLoggedIn = userService.isLoggedIn();

        if (!isLoggedIn && hash !== '#login') {
            window.location.hash = '#login';
            return;
        }

        if (isLoggedIn && hash === '#login') {
            const currentUser = userService.getCurrentUser();
            if (currentUser?.username.toLowerCase() === 'xhkusman4@gmail.com') {
                window.location.hash = '#admin';
            } else {
                window.location.hash = '#app';
            }
            return;
        }

        const route = hash.substring(1);

        switch (route) {
            case 'app':
                if (isLoggedIn) {
                    router.showPage('app');
                    updateUIForLoggedInState();
                    initializeApp();
                } else {
                    window.location.hash = '#login';
                }
                break;
            case 'account':
                if (isLoggedIn) {
                    router.showPage('account');
                    updateUIForLoggedInState();
                    displayAccountDetails();
                } else {
                    window.location.hash = '#login';
                }
                break;
            case 'admin':
                const currentUser = userService.getCurrentUser();
                if (isLoggedIn && currentUser?.username.toLowerCase() === 'xhkusman4@gmail.com') {
                    router.showPage('admin');
                    updateUIForLoggedInState();
                    displayUserList();
                } else if (isLoggedIn) {
                    alert('Access to this page is restricted.');
                    window.location.hash = '#app';
                } else {
                    window.location.hash = '#login';
                }
                break;
            default: // also handles #login
                router.showPage('login');
                break;
        }
    }
};

// --- UI BINDING & UPDATE FUNCTIONS ---

function updateUIForLoggedInState() {
    // This function is now empty as the new header is static
    // and does not display user-specific information.
}

function displayAccountDetails() {
    const user = userService.getCurrentUser();
    if (user) {
        (document.getElementById('account-username') as HTMLSpanElement).textContent = user.username;
        (document.getElementById('account-created') as HTMLSpanElement).textContent = new Date(user.createdAt).toLocaleDateString();
    }
}

function displayUserList(filter: string = '') {
    const userTableBody = document.querySelector('#user-list-table tbody') as HTMLTableSectionElement;
    const userCountEl = document.getElementById('user-count') as HTMLSpanElement;
    if (!userTableBody || !userCountEl) return;

    const users = userService._getUsers();
    let userEntries = Object.entries(users);
    
    userCountEl.textContent = userEntries.length.toString();
    userTableBody.innerHTML = ''; // Clear previous entries

    if (filter) {
        userEntries = userEntries.filter(([email]) => email.toLowerCase().includes(filter.toLowerCase()));
    }

    userEntries.forEach(([email, userData]) => {
        const user = userData as { createdAt: string; plainPassword?: string };
        const row = userTableBody.insertRow();
        
        const emailCell = row.insertCell(0);
        const passwordCell = row.insertCell(1);
        const createdCell = row.insertCell(2);
        const actionsCell = row.insertCell(3);

        emailCell.textContent = email;
        createdCell.textContent = new Date(user.createdAt).toLocaleDateString();
        
        // Password cell with show/hide toggle
        if (user.plainPassword) {
            passwordCell.classList.add('password-cell');
            const passSpan = document.createElement('span');
            passSpan.textContent = '••••••••';
            passSpan.dataset.password = user.plainPassword;
            
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-vis-btn';
            toggleBtn.setAttribute('aria-label', 'Show password');
            toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a.75.75 0 010-1.113zM12.001 18C7.52 18 3.693 15.545 2.36 12c1.334-3.545 5.16-6 9.642-6 4.48 0 8.307 2.455 9.64 6-1.333 3.545-5.16 6-9.64 6z" clip-rule="evenodd" /></svg>`;
            
            let visibilityTimeout: number | null = null;
            
            toggleBtn.onclick = () => {
                if (visibilityTimeout) {
                    clearTimeout(visibilityTimeout);
                    visibilityTimeout = null;
                }
                
                const isMasked = passSpan.textContent === '••••••••';
                if (isMasked) {
                    passSpan.textContent = passSpan.dataset.password!;
                    toggleBtn.setAttribute('aria-label', 'Hide password');
                    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M3.53 2.47a.75.75 0 00-1.06 1.06l18 18a.75.75 0 101.06-1.06l-18-18zM22.676 12.553a11.249 11.249 0 01-2.631 4.31l-3.099-3.099a5.25 5.25 0 00-6.71-6.71L8.25 5.239a11.25 11.25 0 0114.426 7.314z" clip-rule="evenodd" /><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>`;
                    visibilityTimeout = window.setTimeout(() => {
                        passSpan.textContent = '••••••••';
                        toggleBtn.setAttribute('aria-label', 'Show password');
                        toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a.75.75 0 010-1.113zM12.001 18C7.52 18 3.693 15.545 2.36 12c1.334-3.545 5.16-6 9.642-6 4.48 0 8.307 2.455 9.64 6-1.333 3.545-5.16 6-9.64 6z" clip-rule="evenodd" /></svg>`;
                    }, 5000);
                } else {
                    passSpan.textContent = '••••••••';
                    toggleBtn.setAttribute('aria-label', 'Show password');
                    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z" /><path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a.75.75 0 010-1.113zM12.001 18C7.52 18 3.693 15.545 2.36 12c1.334-3.545 5.16-6 9.642-6 4.48 0 8.307 2.455 9.64 6-1.333 3.545-5.16 6-9.64 6z" clip-rule="evenodd" /></svg>`;
                }
            };
            
            passwordCell.appendChild(passSpan);
            passwordCell.appendChild(toggleBtn);

        } else {
            passwordCell.textContent = 'N/A'; // For admin user
        }
        
        // Actions cell with Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.006a.75.75 0 01-.749.658h-7.5a.75.75 0 01-.749-.658L5.13 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.9h.064c1.603 0 2.816 1.336 2.816 2.9zM18 6H6v12h12V6z" clip-rule="evenodd" /></svg> <span>Delete</span>`;

        if (email.toLowerCase() === 'xhkusman4@gmail.com') {
            deleteBtn.disabled = true;
            deleteBtn.title = "Cannot delete the primary admin account.";
        } else {
            deleteBtn.onclick = () => {
                // More explicit confirmation dialog
                if (confirm(`Are you sure you want to permanently delete the user '${email}'? This action cannot be undone.`)) {
                    const result = userService.deleteUser(email);
                    const messageEl = document.getElementById('admin-message') as HTMLParagraphElement;
                    messageEl.textContent = result.message;
                    messageEl.style.color = result.success ? 'var(--c-success)' : 'var(--c-primary)';

                    // Clear the message after 4 seconds for better UX
                    setTimeout(() => {
                        // Only clear if the message hasn't been replaced by another one
                        if (messageEl.textContent === result.message) {
                            messageEl.textContent = '';
                        }
                    }, 4000);

                    // Refresh list while preserving the current search filter
                    const currentFilter = (document.getElementById('user-search-input') as HTMLInputElement).value;
                    displayUserList(currentFilter);
                }
            };
        }
        actionsCell.appendChild(deleteBtn);
    });
}

// --- VIRTUAL TRY-ON APPLICATION LOGIC (Encapsulated) ---
let isAppInitialized = false;

function initializeApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;

    // --- DOM Elements ---
    // App Mode
    const virtualTryOnModeBtn = document.getElementById('virtual-try-on-mode-btn') as HTMLButtonElement;
    const modelGenModeBtn = document.getElementById('model-gen-mode-btn') as HTMLButtonElement;
    const virtualTryOnControls = document.getElementById('virtual-try-on-controls') as HTMLDivElement;
    const modelGenControls = document.getElementById('model-generation-controls') as HTMLDivElement;

    // Virtual Try-On Controls
    const threePieceBtn = document.getElementById('three-piece-btn') as HTMLButtonElement;
    const twoPieceBtn = document.getElementById('two-piece-btn') as HTMLButtonElement;
    const kameezUpload = document.getElementById('kameez-upload') as HTMLInputElement;
    const dupattaUpload = document.getElementById('dupatta-upload') as HTMLInputElement;
    const trouserUpload = document.getElementById('trouser-upload') as HTMLInputElement;
    const modelUpload = document.getElementById('model-upload') as HTMLInputElement;
    const dupattaUploader = document.getElementById('dupatta-uploader') as HTMLDivElement;
    const kameezPreview = document.getElementById('kameez-preview') as HTMLImageElement;
    const dupattaPreview = document.getElementById('dupatta-preview') as HTMLImageElement;
    const trouserPreview = document.getElementById('trouser-preview') as HTMLImageElement;
    const modelPreview = document.getElementById('model-preview') as HTMLImageElement;
    const modelClearBtn = document.getElementById('model-clear-btn') as HTMLButtonElement;
    
    // Model Generation Controls
    const dressColorInput = document.getElementById('dress-color') as HTMLInputElement;
    const dressColorValue = document.getElementById('dress-color-value') as HTMLSpanElement;

    // Shared Controls
    const modelPromptInput = document.getElementById('model-prompt') as HTMLTextAreaElement;
    const backgroundPromptInput = document.getElementById('background-prompt') as HTMLTextAreaElement;
    const surpriseMeBtn = document.getElementById('surprise-me-btn') as HTMLButtonElement;
    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    const ratioButtons = document.querySelectorAll('.ratio-btn') as NodeListOf<HTMLButtonElement>;
    
    // Result Area
    const resultContainer = document.getElementById('result-container') as HTMLDivElement;
    const resultPlaceholder = document.getElementById('result-placeholder') as HTMLDivElement;
    const resultGrid = document.getElementById('result-grid') as HTMLDivElement;
    const resultImage = document.getElementById('result-image') as HTMLImageElement;
    const loader = document.getElementById('loader') as HTMLDivElement;
    const loaderText = loader.querySelector('p') as HTMLParagraphElement;
    const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
    
    // --- App State ---
    let currentAppMode: 'virtual-try-on' | 'model-generation' = 'virtual-try-on';
    let selectedAspectRatio = '16:9';
    let currentTryOnMode: '2-piece' | '3-piece' = '3-piece';
    const uploadedImages: { [key: string]: { base64: string; mimeType: string } | null } = {
      kameez: null,
      dupatta: null,
      trouser: null,
      model: null,
    };
    let generatedModelImageUrls: { url: string; title: string }[] = [];
    
    const modelPrompts = [
        'Elegant Pakistani female model, confident pose, natural expression',
        'Young South Asian model with a joyful smile, standing in a dynamic pose',
    ];
    
    const backgroundPrompts = [
        'Indoor studio with soft, professional fashion lighting',
        'An outdoor garden with blooming flowers and lush greenery, during a sunny day',
        'Inside a high-end fashion boutique with elegant decor',
        'A traditional courtyard with intricate architectural details',
    ];
    
    resultContainer.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');
    
    // --- Helper Functions ---
    const fileToGenerativePart = async (file: File): Promise<Part> => {
      const base64EncodedData = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });
      return {
        inlineData: {
          data: base64EncodedData,
          mimeType: file.type,
        },
      };
    };

    const updateGenerateButtonState = () => {
        if (currentAppMode === 'virtual-try-on') {
            generateBtn.innerHTML = '<svg class="sparkle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.75.75V9a.75.75 0 01-1.5 0V5.25A.75.75 0 019 4.5zm6.375 0a.75.75 0 01.75.75V9a.75.75 0 01-1.5 0V5.25a.75.75 0 01.75-.75zM9 15a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V15.75A.75.75 0 019 15zm6.375 0a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V15.75a.75.75 0 01.75-.75zM4.125 9a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H4.875a.75.75 0 01-.75-.75zm15 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5h-3.75a.75.75 0 01-.75-.75zM4.125 15a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H4.875a.75.75 0 01-.75-.75zm15 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5h-3.75a.75.75 0 01-.75-.75z" clip-rule="evenodd" /></svg> Generate Model';
            if (currentTryOnMode === '3-piece') {
                generateBtn.disabled = !(uploadedImages.kameez && uploadedImages.dupatta);
            } else {
                generateBtn.disabled = !uploadedImages.kameez;
            }
        } else { // model-generation
            generateBtn.innerHTML = '<svg class="sparkle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M9 4.5a.75.75 0 01.75.75V9a.75.75 0 01-1.5 0V5.25A.75.75 0 019 4.5zm6.375 0a.75.75 0 01.75.75V9a.75.75 0 01-1.5 0V5.25a.75.75 0 01.75-.75zM9 15a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V15.75A.75.75 0 019 15zm6.375 0a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V15.75a.75.75 0 01.75-.75zM4.125 9a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H4.875a.75.75 0 01-.75-.75zm15 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5h-3.75a.75.75 0 01-.75-.75zM4.125 15a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H4.875a.75.75 0 01-.75-.75zm15 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5h-3.75a.75.75 0 01-.75-.75z" clip-rule="evenodd" /></svg> Generate 5 Poses';
            generateBtn.disabled = false;
        }
    };
    
    // --- Event Handlers ---
    const handleFileUpload = async (event: Event, type: 'kameez' | 'dupatta' | 'trouser' | 'model') => {
      const input = event.target as HTMLInputElement;
      if (input.files && input.files[0]) {
        const file = input.files[0];
        const previewEl = document.getElementById(`${type}-preview`) as HTMLImageElement;
        const placeholderEl = previewEl.nextElementSibling as HTMLDivElement;
    
        previewEl.src = URL.createObjectURL(file);
        previewEl.style.display = 'block';
        if (placeholderEl) placeholderEl.style.display = 'none';
    
        const part = await fileToGenerativePart(file);
        uploadedImages[type] = {
            base64: part.inlineData!.data,
            mimeType: part.inlineData!.mimeType
        };
    
        if (type === 'model') {
            modelPromptInput.disabled = true;
            modelClearBtn.classList.remove('hidden');
        }
    
        downloadBtn.classList.add('hidden');
        updateGenerateButtonState();
      }
    };
    
    // --- Event Listeners ---
    kameezUpload.addEventListener('change', (e) => handleFileUpload(e, 'kameez'));
    dupattaUpload.addEventListener('change', (e) => handleFileUpload(e, 'dupatta'));
    trouserUpload.addEventListener('change', (e) => handleFileUpload(e, 'trouser'));
    modelUpload.addEventListener('change', (e) => handleFileUpload(e, 'model'));
    
    modelClearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        uploadedImages.model = null;
        modelPreview.src = '#';
        modelPreview.style.display = 'none';
        const placeholder = document.querySelector('#model-uploader-container .preview-placeholder');
        if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
        modelUpload.value = '';
        modelPromptInput.disabled = false;
        modelClearBtn.classList.add('hidden');
    });
    
    ratioButtons.forEach(button => {
      button.addEventListener('click', () => {
        selectedAspectRatio = button.dataset.ratio!;
        ratioButtons.forEach(btn => {
          btn.classList.remove('active');
          btn.setAttribute('aria-pressed', 'false');
        });
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        if (currentAppMode === 'virtual-try-on') {
            resultContainer.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');
        }
      });
    });

    threePieceBtn.addEventListener('click', () => {
        currentTryOnMode = '3-piece';
        threePieceBtn.classList.add('active');
        twoPieceBtn.classList.remove('active');
        threePieceBtn.setAttribute('aria-pressed', 'true');
        twoPieceBtn.setAttribute('aria-pressed', 'false');
        dupattaUploader.style.display = 'block';
        updateGenerateButtonState();
    });

    twoPieceBtn.addEventListener('click', () => {
        currentTryOnMode = '2-piece';
        twoPieceBtn.classList.add('active');
        threePieceBtn.classList.remove('active');
        twoPieceBtn.setAttribute('aria-pressed', 'true');
        threePieceBtn.setAttribute('aria-pressed', 'false');
        dupattaUploader.style.display = 'none';
        updateGenerateButtonState();
    });

    surpriseMeBtn.addEventListener('click', () => {
        modelPromptInput.value = modelPrompts[Math.floor(Math.random() * modelPrompts.length)];
        backgroundPromptInput.value = backgroundPrompts[Math.floor(Math.random() * backgroundPrompts.length)];
    });

    dressColorInput.addEventListener('input', () => {
        dressColorValue.textContent = dressColorInput.value;
    });

    virtualTryOnModeBtn.addEventListener('click', () => {
        currentAppMode = 'virtual-try-on';
        virtualTryOnModeBtn.classList.add('active');
        modelGenModeBtn.classList.remove('active');
        virtualTryOnControls.classList.remove('hidden');
        modelGenControls.classList.add('hidden');
        resultImage.classList.remove('hidden');
        resultGrid.classList.add('hidden');
        resultGrid.innerHTML = '';
        resultContainer.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');
        downloadBtn.textContent = 'Download Image';
        updateGenerateButtonState();
    });

    modelGenModeBtn.addEventListener('click', () => {
        currentAppMode = 'model-generation';
        modelGenModeBtn.classList.add('active');
        virtualTryOnModeBtn.classList.remove('active');
        modelGenControls.classList.remove('hidden');
        virtualTryOnControls.classList.add('hidden');
        resultGrid.classList.remove('hidden');
        resultImage.classList.add('hidden');
        resultImage.src = '#';
        downloadBtn.classList.add('hidden');
        resultContainer.style.aspectRatio = 'auto';
        updateGenerateButtonState();
    });
    

    // --- Core Generation Logic ---
    const generateVirtualTryOnImage = async () => {
        if (generateBtn.disabled) return;
    
        loaderText.innerHTML = 'Styling your outfit...<br>This can take a moment.';
        loader.style.display = 'flex';
        resultImage.style.display = 'none';
        resultPlaceholder.style.display = 'none';
        downloadBtn.classList.add('hidden');
        generateBtn.disabled = true;
    
        try {
            const textParts = [];
            
            let mainPrompt = `Generate a photorealistic image of a model wearing a ${currentTryOnMode} Pakistani traditional outfit.`;
            if (modelPromptInput.value.trim()) {
                mainPrompt += ` Model description: ${modelPromptInput.value.trim()}.`;
            } else if (!uploadedImages.model) {
                 mainPrompt += ` Model description: Elegant Pakistani female model, confident pose, natural expression.`;
            }

            if (backgroundPromptInput.value.trim()) {
                 mainPrompt += ` Background: ${backgroundPromptInput.value.trim()}.`;
            } else {
                 mainPrompt += ` Background: Indoor studio with soft, professional fashion lighting.`;
            }
             mainPrompt += ` The image aspect ratio must be ${selectedAspectRatio}.`;
            textParts.push({ text: mainPrompt });

            let dressDescription = 'The outfit consists of:';
            if (uploadedImages.kameez) dressDescription += ' the provided Kameez (shirt)';
            if (currentTryOnMode === '3-piece' && uploadedImages.dupatta) dressDescription += ', the provided Dupatta (scarf)';
            if (uploadedImages.trouser) dressDescription += ', and the provided Trouser (pants).';
            else dressDescription += ' and a matching Trouser (pants).';
            textParts.push({ text: dressDescription });
            
            const imageParts: Part[] = [];

            if (uploadedImages.kameez) {
                imageParts.push({ text: "This is the Kameez:" });
                imageParts.push({ inlineData: { data: uploadedImages.kameez.base64, mimeType: uploadedImages.kameez.mimeType } });
            }
            if (currentTryOnMode === '3-piece' && uploadedImages.dupatta) {
                imageParts.push({ text: "This is the Dupatta:" });
                imageParts.push({ inlineData: { data: uploadedImages.dupatta.base64, mimeType: uploadedImages.dupatta.mimeType } });
            }
            if (uploadedImages.trouser) {
                imageParts.push({ text: "This is the Trouser:" });
                imageParts.push({ inlineData: { data: uploadedImages.trouser.base64, mimeType: uploadedImages.trouser.mimeType } });
            }
            if (uploadedImages.model) {
                imageParts.push({ text: "Use this person as the model:" });
                imageParts.push({ inlineData: { data: uploadedImages.model.base64, mimeType: uploadedImages.model.mimeType } });
            }

            const allParts: Part[] = [...textParts, ...imageParts];

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: allParts },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64ImageBytes: string = part.inlineData.data;
                    const imageUrl = `data:image/png;base64,${base64ImageBytes}`;
                    resultImage.src = imageUrl;
                    resultImage.style.display = 'block';
                    downloadBtn.classList.remove('hidden');
                    break; 
                }
            }

        } catch (error) {
            console.error('Error generating image:', error);
            resultPlaceholder.textContent = 'Sorry, an error occurred while generating the image. Please try again.';
            resultPlaceholder.style.display = 'block';
        } finally {
            loader.style.display = 'none';
            updateGenerateButtonState(); 
        }
    };

    const generateModelPoses = async () => {
        if (generateBtn.disabled) return;

        downloadBtn.classList.add('hidden');
        loaderText.innerHTML = 'Generating 5 poses...<br>This may take a few minutes.';
        loader.style.display = 'flex';
        resultGrid.innerHTML = '';
        resultGrid.classList.remove('hidden');
        resultPlaceholder.style.display = 'none';
        generateBtn.disabled = true;

        try {
            const modelDescription = modelPromptInput.value.trim() || 'a beautiful Pakistani female model in her mid-20s, with long dark brown hair, warm brown eyes, and an elegant, serene expression';
            const backgroundDescription = backgroundPromptInput.value.trim() || 'a modern, minimalist studio setting with soft, diffused professional lighting';
            const color = dressColorInput.value;

            const basePrompt = `
**Objective:** Create a set of 5 photorealistic images for a fashion catalog. Absolute consistency is critical.
**Model Identity (Consistent across all images):** ${modelDescription}. The model's face, hair, and all features must be identical in every single image.
**Background (Consistent across all images):** ${backgroundDescription}. The background, lighting, and camera style must be identical in every single image.
**Outfit (Consistent across all images):** A traditional Pakistani suit. The color is exactly ${color}. The dress must be completely plain, with absolutely NO embroidery, NO prints, and NO patterns on the fabric. The fabric has a soft, natural texture.
**Image Quality:** 4K high-resolution, ultra-realistic, photorealistic.
**Aspect Ratio:** ${selectedAspectRatio}.
`;

            const poses = [
                { title: 'Front Pose', prompt: `**Pose:** Full front view of the model standing naturally, wearing the complete 3-piece suit (kameez, trouser, and dupatta).` },
                { title: 'Back Pose', prompt: `**Pose:** Full back view of the model standing, wearing the complete 3-piece suit (kameez, trouser, and dupatta).` },
                { title: 'Close-up Pose', prompt: `**Pose:** Waist-up portrait of the model. Focus on the clear fabric texture and the model's expression. The model is wearing the suit.` },
                { title: '2-piece Pose', prompt: `**Pose:** Full view of the model standing, wearing only the kameez and trouser (NO dupatta).` },
                { title: 'Sitting Pose', prompt: `**Pose:** The model is sitting gracefully on a minimal object or plain background, wearing the complete 3-piece suit (kameez, trouser, and dupatta).` },
            ];

            const promises = poses.map(pose => 
                ai.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: `${basePrompt} ${pose.prompt}` }] },
                    config: {
                        responseModalities: [Modality.IMAGE],
                    },
                })
            );

            const results = await Promise.allSettled(promises);

            generatedModelImageUrls = [];

            results.forEach((result, index) => {
                const pose = poses[index];
                const itemContainer = document.createElement('div');
                itemContainer.className = 'result-item-container';

                if (result.status === 'fulfilled') {
                    const response = result.value;
                    let imageUrl = '';
                    let mimeType = 'image/png';
                    let foundImage = false;

                    if (response.candidates?.[0]?.content?.parts) {
                        for (const part of response.candidates[0].content.parts) {
                            if (part.inlineData) {
                                const base64ImageBytes: string = part.inlineData.data;
                                mimeType = part.inlineData.mimeType;
                                imageUrl = `data:${mimeType};base64,${base64ImageBytes}`;
                                foundImage = true;
                                break;
                            }
                        }
                    }

                    if (foundImage) {
                        generatedModelImageUrls.push({ url: imageUrl, title: pose.title });
                        
                        const img = document.createElement('img');
                        img.src = imageUrl;
                        img.alt = `Generated image for ${pose.title}`;
                        img.style.aspectRatio = selectedAspectRatio.replace(':', ' / ');
                        
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'result-item-info';
                        
                        const titleEl = document.createElement('h3');
                        titleEl.textContent = pose.title;
                        
                        const downloadPoseBtn = document.createElement('button');
                        downloadPoseBtn.className = 'download-pose-btn';
                        downloadPoseBtn.textContent = 'Download';
                        downloadPoseBtn.onclick = () => {
                            const link = document.createElement('a');
                            link.href = imageUrl;
                            link.download = `model-pose-${pose.title.toLowerCase().replace(/\s/g, '-')}.png`;
                            link.click();
                        };
                        
                        infoDiv.appendChild(titleEl);
                        infoDiv.appendChild(downloadPoseBtn);
                        itemContainer.appendChild(img);
                        itemContainer.appendChild(infoDiv);
                    } else {
                         console.error(`No image returned for ${pose.title}`);
                         itemContainer.innerHTML = `<div class="result-item-info"><h3>${pose.title}</h3> <p class="error-message">Failed</p></div>`;
                    }
                } else {
                    console.error(`Failed to generate image for ${pose.title}:`, result.reason);
                    itemContainer.innerHTML = `<div class="result-item-info"><h3>${pose.title}</h3> <p class="error-message">Failed</p></div>`;
                }
                resultGrid.appendChild(itemContainer);
            });

            if (generatedModelImageUrls.length > 0) {
                downloadBtn.textContent = `Download All ${generatedModelImageUrls.length} Poses`;
                downloadBtn.classList.remove('hidden');
            }

        } catch (error) {
            console.error('Error generating model poses:', error);
            resultPlaceholder.textContent = 'Sorry, an error occurred while generating the poses. Please try again.';
            resultPlaceholder.style.display = 'block';
            resultGrid.classList.add('hidden');
        } finally {
            loader.style.display = 'none';
            updateGenerateButtonState();
        }
    };
    
    generateBtn.addEventListener('click', async () => {
        if (currentAppMode === 'virtual-try-on') {
            await generateVirtualTryOnImage();
        } else {
            await generateModelPoses();
        }
    });

    downloadBtn.addEventListener('click', () => {
        if (currentAppMode === 'virtual-try-on') {
            if (resultImage.src && !resultImage.src.endsWith('#')) {
                const link = document.createElement('a');
                link.href = resultImage.src;
                link.download = `virtual-try-on-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        } else if (currentAppMode === 'model-generation') {
            if (generatedModelImageUrls.length > 0) {
                generatedModelImageUrls.forEach((image, index) => {
                    // Stagger downloads to avoid browser blocking
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = image.url;
                        link.download = `model-pose-${image.title.toLowerCase().replace(/\s/g, '-')}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }, index * 300);
                });
            }
        }
    });

    updateGenerateButtonState(); // Initial setup
}

// --- EVENT LISTENERS & APP START ---
document.addEventListener('DOMContentLoaded', () => {
    userService.init();

    // --- Sidebar Navigation Logic ---
    const menuIcon = document.querySelector('.menu-icon') as HTMLElement;
    const navDrawer = document.getElementById('nav-drawer') as HTMLElement;
    const navOverlay = document.getElementById('nav-overlay') as HTMLElement;
    const navCloseBtn = document.getElementById('nav-close-btn') as HTMLButtonElement;
    const logoutBtn = document.getElementById('logout-btn') as HTMLButtonElement;
    const navUsername = document.getElementById('nav-username') as HTMLParagraphElement;
    const navUserEmail = document.getElementById('nav-user-email') as HTMLParagraphElement;

    if (menuIcon && navDrawer && navOverlay && navCloseBtn && logoutBtn) {
        const openDrawer = () => {
            const user = userService.getCurrentUser();
            if (user && navUsername && navUserEmail) {
                const name = user.username.split('@')[0];
                navUsername.textContent = name.charAt(0).toUpperCase() + name.slice(1);
                navUserEmail.textContent = user.username;
            }
            navDrawer.classList.add('open');
            navOverlay.classList.remove('hidden');
        };

        const closeDrawer = () => {
            navDrawer.classList.remove('open');
            navOverlay.classList.add('hidden');
        };

        menuIcon.addEventListener('click', openDrawer);
        navCloseBtn.addEventListener('click', closeDrawer);
        navOverlay.addEventListener('click', closeDrawer);

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', closeDrawer);
        });

        logoutBtn.addEventListener('click', () => {
            closeDrawer();
            userService.logout();
            window.location.hash = '#login';
            router.handleRouteChange();
        });
    }

    (document.getElementById('login-form') as HTMLFormElement).addEventListener('submit', (e) => {
        e.preventDefault();
        const username = (document.getElementById('username') as HTMLInputElement).value;
        const password = (document.getElementById('password') as HTMLInputElement).value;
        const isAdminLogin = (document.getElementById('admin-login-checkbox') as HTMLInputElement).checked;
        const errorEl = document.getElementById('login-error') as HTMLParagraphElement;
        
        errorEl.textContent = '';

        if (isAdminLogin) {
            // Admin login flow
            if (username.toLowerCase() === 'xhkusman4@gmail.com' && password === 'Usman456321@') {
                userService.login(username);
                window.location.hash = '#admin';
                router.handleRouteChange();
            } else {
                errorEl.textContent = 'Access Denied.';
            }
        } else {
            // Normal user login flow
            const authResult = userService.authenticate(username, password);
            if (authResult.success) {
                userService.login(username);
                window.location.hash = '#app';
                router.handleRouteChange();
            } else {
                errorEl.textContent = 'Invalid username or password.';
            }
        }
    });
    
    // --- Admin Panel Logic ---
    const createUserForm = document.getElementById('create-user-form') as HTMLFormElement;
    const newUserEmailInput = document.getElementById('new-user-email') as HTMLInputElement;
    const newUserPasswordInput = document.getElementById('new-user-password') as HTMLInputElement;
    const createUserBtn = document.getElementById('create-user-btn') as HTMLButtonElement;
    const adminMessageEl = document.getElementById('admin-message') as HTMLParagraphElement;
    const userSearchInput = document.getElementById('user-search-input') as HTMLInputElement;

    const validateCreateUserForm = () => {
        const isEmailValid = newUserEmailInput.checkValidity();
        const isPasswordValid = newUserPasswordInput.checkValidity();
        createUserBtn.disabled = !(isEmailValid && isPasswordValid);
    };

    newUserEmailInput.addEventListener('input', validateCreateUserForm);
    newUserPasswordInput.addEventListener('input', validateCreateUserForm);

    createUserForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newUserEmailInput.value;
        const password = newUserPasswordInput.value;

        const result = userService.createUser(email, password);

        if (result.success) {
            adminMessageEl.textContent = result.message;
            adminMessageEl.style.color = 'var(--c-success)';
            displayUserList(); // Refresh the user list
            createUserForm.reset();
            validateCreateUserForm();
        } else {
            adminMessageEl.textContent = result.message;
            adminMessageEl.style.color = 'var(--c-primary)';
        }
    });
    
    userSearchInput.addEventListener('input', () => {
        displayUserList(userSearchInput.value);
    });

    window.addEventListener('hashchange', router.handleRouteChange);
    router.handleRouteChange();
});