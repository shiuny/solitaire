document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 定数とDOM要素
    // =========================================================================
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const SUIT_COLORS = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };
    const SUIT_CLASS_MAP = { '♠': 'suit-s', '♥': 'suit-h', '♦': 'suit-d', '♣': 'suit-c' };

    const gameContainer = document.getElementById('game-container');
    const gameBoard = document.getElementById('game-board');
    const stockEl = document.getElementById('stock');
    const wasteEl = document.getElementById('waste');
    const foundationsEl = document.getElementById('foundations');
    const tableauEl = document.getElementById('tableau');
    const timeEl = document.getElementById('time');
    const movesEl = document.getElementById('moves');
    const newGameBtn = document.getElementById('new-game-btn');
    const undoBtn = document.getElementById('undo-btn');
    const hintBtn = document.getElementById('hint-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const drawSelect = document.getElementById('draw-select');
    const cardBackOptions = document.getElementById('card-back-options');
    const winModal = document.getElementById('win-modal');
    const winNewGameBtn = document.getElementById('win-new-game-btn');
    const finalTimeEl = document.getElementById('final-time');
    const finalMovesEl = document.getElementById('final-moves');
    const gamesPlayedEl = document.getElementById('games-played');
    const gamesWonEl = document.getElementById('games-won');
    const winRateEl = document.getElementById('win-rate');
    const stuckModal = document.getElementById('stuck-modal');
    const stuckNewGameBtn = document.getElementById('stuck-new-game-btn');
    const stuckCloseBtn = document.getElementById('stuck-close-btn');

    // =========================================================================
    // ゲーム状態
    // =========================================================================
    let state = {};
    let stats = { gamesPlayed: 0, gamesWon: 0 };
    let currentGameSettings = { drawCount: 3, cardBack: 'back1' };
    let timerInterval;
    let seconds = 0;
    
    let dragInfo = {
        isDragging: false, element: null, cards: [], from: {},
        offsetX: 0, offsetY: 0, animationFrameId: null
    };
    let isAutocompleting = false;
    let isDealing = false;
    let winAnimationId = null; // 勝利アニメーションのID

    // =========================================================================
    // ゲーム初期化と進行
    // =========================================================================
    function startGame() {
        if (winAnimationId) cancelAnimationFrame(winAnimationId);
        document.querySelectorAll('.win-animation-card').forEach(c => c.remove());
        
        stopTimer(); seconds = 0; updateTimerDisplay();
        isAutocompleting = false;
        isDealing = true;
        currentGameSettings.drawCount = parseInt(drawSelect.value, 10);
        currentGameSettings.cardBack = document.querySelector('.card-back-option.selected')?.dataset.back || 'back1';

        state = {
            tableau: [[], [], [], [], [], [], []], foundations: [[], [], [], []],
            stock: createAndShuffleDeck(), waste: [], moves: 0, history: [],
        };
        
        dealCards().then(() => {
            isDealing = false;
            startTimer();
            stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
            updateStatsDisplay();
        });
    }

    function createAndShuffleDeck() {
        const deck = [];
        SUITS.forEach(suit => {
            RANKS.forEach((rank, i) => {
                deck.push({ suit, rank, value: i + 1, color: SUIT_COLORS[suit], isFaceUp: false, id: `${rank}-${suit}` });
            });
        });
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    async function dealCards() {
        renderAll(); 
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                if (state.stock.length > 0) {
                    const card = state.stock.pop();
                    state.tableau[j].push(card);
                }
            }
        }
        renderAll();
        await new Promise(resolve => setTimeout(resolve, 50));

        const flipPromises = [];
        for (let i = 0; i < 7; i++) {
            const pile = state.tableau[i];
            if (pile.length > 0) {
                const cardToFlip = pile[pile.length - 1];
                const cardEl = tableauEl.children[i].lastElementChild;
                if (cardEl && !cardToFlip.isFaceUp) {
                    flipPromises.push(
                        new Promise(resolve => {
                            setTimeout(() => {
                                cardToFlip.isFaceUp = true;
                                flipCard(cardEl, cardToFlip).then(resolve);
                            }, i * 100);
                        })
                    );
                }
            }
        }
        await Promise.all(flipPromises);
    }
    
    // =========================================================================
    // レンダリングとアニメーション
    // =========================================================================
    function renderAll() {
        document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
        tableauEl.innerHTML = ''; foundationsEl.innerHTML = ''; stockEl.innerHTML = ''; wasteEl.innerHTML = '';

        state.tableau.forEach((pile, pileIndex) => {
            const pileSlot = createPileSlot('tableau', pileIndex);
            pile.forEach((card, cardIndex) => {
                const cardEl = createCardElement(card, 'tableau', pileIndex, cardIndex);
                cardEl.style.top = `${cardIndex * 25}%`;
                pileSlot.appendChild(cardEl);
            });
            tableauEl.appendChild(pileSlot);
        });

        state.foundations.forEach((pile, pileIndex) => {
            const pileSlot = createPileSlot('foundation', pileIndex);
            if (pile.length > 0) {
                pileSlot.appendChild(createCardElement(pile[pile.length - 1], 'foundation', pileIndex));
            }
            foundationsEl.appendChild(pileSlot);
        });

        if (state.stock.length > 0) {
            const cardEl = createCardElement(state.stock[0], 'stock');
            cardEl.classList.add('facedown', currentGameSettings.cardBack);
            stockEl.appendChild(cardEl);
        }

        if (state.waste.length > 0) {
            const displayCount = Math.min(state.waste.length, 3);
            const startIndex = state.waste.length - displayCount;
            for (let i = 0; i < displayCount; i++) {
                const card = state.waste[startIndex + i];
                const cardEl = createCardElement(card, 'waste', undefined, i);
                cardEl.style.left = `${i * 20}px`; cardEl.style.zIndex = i;
                wasteEl.appendChild(cardEl);
            }
        }
        updateInfo(); 
        if (!isAutocompleting && !isDealing) {
            checkWinCondition();
        }
    }

    function flipCard(cardElement, cardData) {
        return new Promise(resolve => {
            if (!cardElement || !cardData) return resolve();
            
            const onTransitionEnd = (e) => {
                if (e.propertyName === 'transform') {
                    cardElement.removeEventListener('transitionend', onTransitionEnd);
                    resolve();
                }
            };
            cardElement.addEventListener('transitionend', onTransitionEnd);
            
            requestAnimationFrame(() => {
                cardElement.innerHTML = `
                    <div class="card-top"><span class="card-rank">${cardData.rank}</span><span class="card-suit ${SUIT_CLASS_MAP[cardData.suit]}"></span></div>
                    <div class="card-bottom"><span class="card-rank">${cardData.rank}</span><span class="card-suit ${SUIT_CLASS_MAP[cardData.suit]}"></span></div>`;
                if (cardData.rank === '10') cardElement.classList.add('is-rank-10');
                cardElement.classList.add('faceup', cardData.color);
                cardElement.classList.remove('facedown', 'back1', 'back2');
            });
        });
    }
    
    function createPileSlot(type, index) {
        const pileEl = document.createElement('div');
        pileEl.className = 'card-pile-slot';
        pileEl.dataset.pileType = type;
        if(index !== undefined) pileEl.dataset.pileIndex = index;
        return pileEl;
    }

    function createCardElement(card, pileType, pileIndex, cardIndex) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.id = card.id;
        if (pileType) cardEl.dataset.pileType = pileType;
        if (pileIndex !== undefined) cardEl.dataset.pileIndex = pileIndex;
        if (cardIndex !== undefined) cardEl.dataset.cardIndex = cardIndex;

        if (card.isFaceUp) {
            cardEl.classList.add('faceup', card.color);
            if (card.rank === '10') cardEl.classList.add('is-rank-10');
            cardEl.innerHTML = `
                <div class="card-top"><span class="card-rank">${card.rank}</span><span class="card-suit ${SUIT_CLASS_MAP[card.suit]}"></span></div>
                <div class="card-bottom"><span class="card-rank">${card.rank}</span><span class="card-suit ${SUIT_CLASS_MAP[card.suit]}"></span></div>`;
        } else {
            cardEl.classList.add('facedown', currentGameSettings.cardBack);
        }
        return cardEl;
    }

    // =========================================================================
    // イベントハンドラ
    // =========================================================================
    stockEl.addEventListener('click', handleStockClick);
    gameBoard.addEventListener('dblclick', handleDoubleClick);
    gameBoard.addEventListener('mousedown', handleInteractionStart);
    gameBoard.addEventListener('touchstart', handleInteractionStart, { passive: false });
    
    function handleStockClick() {
        if (dragInfo.isDragging || isAutocompleting || isDealing) return;
        saveStateForUndo();
        if (state.stock.length > 0) {
            const count = Math.min(state.stock.length, currentGameSettings.drawCount);
            const cardsToFlip = [];
            for (let i = 0; i < count; i++) {
                if(state.stock.length === 0) break;
                const card = state.stock.pop();
                card.isFaceUp = true; 
                cardsToFlip.push(card);
                state.waste.push(card);
            }
            state.moves++; 
            renderAll();
            cardsToFlip.forEach(cardData => {
                const cardEl = wasteEl.querySelector(`.card[data-id="${cardData.id}"]`);
                if (cardEl) flipCard(cardEl, cardData);
            });
        } else if (state.waste.length > 0) {
            state.stock.push(...state.waste.reverse());
            state.stock.forEach(c => c.isFaceUp = false); 
            state.waste = [];
            state.moves++; 
            renderAll();
        } else {
            state.history.pop(); 
            return;
        }
        checkForAutoComplete();
    }

    function handleInteractionStart(e) {
        if (e.type === 'mousedown' && e.button !== 0) return;
        if (dragInfo.isDragging || isAutocompleting || isDealing) return;
        
        const clickedEl = e.target.closest('.card');
        if (!clickedEl) return;
        
        const { pileType, pileIndex: pileIndexStr, cardIndex: cardIndexStr } = clickedEl.dataset;
        const pileIndex = pileIndexStr ? parseInt(pileIndexStr, 10) : undefined;
        const cardIndex = cardIndexStr ? parseInt(cardIndexStr, 10) : undefined;
        
        if (!pileType || (pileIndex === undefined && pileType !== 'waste')) return;
        
        const sourcePile = getPile(pileType, pileIndex);
        if (!sourcePile || sourcePile.length === 0) return;
        
        let cardsToDrag = [];
        if (pileType === 'tableau' && cardIndex !== undefined) {
            const card = sourcePile[cardIndex];
            if (card && card.isFaceUp) cardsToDrag = sourcePile.slice(cardIndex);
        } else if (pileType === 'waste') {
            cardsToDrag = [sourcePile[sourcePile.length - 1]];
        } else if (pileType === 'foundation') {
            cardsToDrag = [sourcePile[sourcePile.length - 1]];
        }
        
        if (cardsToDrag.length === 0) return;
        
        const onInteractionMove = (moveEvent) => {
            moveEvent.preventDefault();
            if (!dragInfo.isDragging) {
                dragInfo.isDragging = true;
                initiateDrag(e, clickedEl, cardsToDrag, pileType, pileIndex);
            }
            updateGhostPosition(moveEvent);
        };

        const onInteractionEnd = (upEvent) => {
            document.removeEventListener('mousemove', onInteractionMove);
            document.removeEventListener('mouseup', onInteractionEnd);
            document.removeEventListener('touchmove', onInteractionMove);
            document.removeEventListener('touchend', onInteractionEnd);
            if (dragInfo.isDragging) { finishDrag(); }
            dragInfo.isDragging = false;
        };

        document.addEventListener('mousemove', onInteractionMove);
        document.addEventListener('mouseup', onInteractionEnd);
        document.addEventListener('touchmove', onInteractionMove, { passive: false });
        document.addEventListener('touchend', onInteractionEnd);
    }
    
    function initiateDrag(startEvent, baseEl, cards, pileType, pileIndex) {
        saveStateForUndo();
        document.body.classList.add('dragging-no-select');
        const rect = baseEl.getBoundingClientRect();
        const touch = startEvent.touches ? startEvent.touches[0] : startEvent;
        dragInfo.offsetX = touch.clientX - rect.left;
        dragInfo.offsetY = touch.clientY - rect.top;
        dragInfo.cards = cards;
        dragInfo.from = { type: pileType, index: pileIndex };
        dragInfo.element = createGhost(baseEl, cards);
        document.body.appendChild(dragInfo.element);
        updateGhostPosition(startEvent);
        cards.forEach(card => {
            const el = document.querySelector(`.card[data-id="${card.id}"]`);
            if (el) el.style.opacity = '0.5';
        });
    }

    function finishDrag() {
        if (dragInfo.animationFrameId) cancelAnimationFrame(dragInfo.animationFrameId);
        document.body.classList.remove('dragging-no-select');
        const dropTarget = findBestDropTarget();
        if (dragInfo.element) document.body.removeChild(dragInfo.element);
        
        if (dropTarget) {
            moveCards(dragInfo.cards, dragInfo.from.type, dragInfo.from.index, dropTarget.dataset.pileType, dropTarget.dataset.pileIndex);
        } else {
            state.history.pop();
            renderAll();
        }
        dragInfo = { isDragging: false, element: null, cards: [], from: {}, offsetX: 0, offsetY: 0, animationFrameId: null };
    }

    function updateGhostPosition(moveEvent) {
        if (dragInfo.animationFrameId) cancelAnimationFrame(dragInfo.animationFrameId);
        dragInfo.animationFrameId = requestAnimationFrame(() => {
            if (dragInfo.element) {
                 const moveTouch = moveEvent.touches ? moveEvent.touches[0] : moveEvent;
                 const x = moveTouch.clientX - dragInfo.offsetX;
                 const y = moveTouch.clientY - dragInfo.offsetY;
                 dragInfo.element.style.transform = `translate(${x}px, ${y}px)`;
            }
        });
    }

    function createGhost(baseEl, cards) {
        const computedStyle = window.getComputedStyle(baseEl);
        const ghostContainer = document.createElement('div');
        ghostContainer.style.position = 'fixed';
        ghostContainer.style.zIndex = '1000';
        ghostContainer.style.pointerEvents = 'none';
        ghostContainer.style.left = `0px`; 
        ghostContainer.style.top = `0px`;
        ghostContainer.style.width = computedStyle.width;
        ghostContainer.style.height = computedStyle.height;
        
        cards.forEach((card, i) => {
            const ghostCardEl = createCardElement(card);
            ghostCardEl.style.position = 'absolute';
            ghostCardEl.style.width = '100%';
            ghostCardEl.style.height = '100%';
            ghostCardEl.style.top = `${i * (parseFloat(computedStyle.height) * 0.25)}px`;
            ghostContainer.appendChild(ghostCardEl);
        });
        return ghostContainer;
    }

    function findBestDropTarget() {
        if (!dragInfo.element) return null;
        const ghostRect = dragInfo.element.getBoundingClientRect();
        let bestTarget = null;
        let maxOverlap = 0;
        const potentialTargets = document.querySelectorAll('#foundations .card-pile-slot, #tableau .card-pile-slot');
        potentialTargets.forEach(slotEl => {
            const pileType = slotEl.dataset.pileType;
            const pileIndex = parseInt(slotEl.dataset.pileIndex, 10);
            if (pileType === dragInfo.from.type && pileIndex === dragInfo.from.index) return;
            const targetEl = slotEl.lastElementChild || slotEl;
            const targetRect = targetEl.getBoundingClientRect();
            const overlap = getOverlapArea(ghostRect, targetRect);
            const isValid = isValidMove(dragInfo.cards[0], pileType, pileIndex);
            if (overlap > maxOverlap && isValid) {
                maxOverlap = overlap;
                bestTarget = slotEl;
            }
        });
        return bestTarget;
    }

    function getOverlapArea(rectA, rectB) {
        const xOverlap = Math.max(0, Math.min(rectA.right, rectB.right) - Math.max(rectA.left, rectB.left));
        const yOverlap = Math.max(0, Math.min(rectA.bottom, rectB.bottom) - Math.max(rectA.top, rectB.top));
        return xOverlap * yOverlap;
    }

    function handleDoubleClick(e) {
        if (isAutocompleting || isDealing) return;
        const cardEl = e.target.closest('.card[data-id]');
        if (!cardEl) return;
        const { pileType, pileIndex: pileIndexStr, cardIndex: cardIndexStr } = cardEl.dataset;
        const pileIndex = pileIndexStr ? parseInt(pileIndexStr, 10) : undefined;
        const cardIndex = cardIndexStr ? parseInt(cardIndexStr, 10) : undefined;
        const sourcePile = getPile(pileType, pileIndex);
        if (!sourcePile || sourcePile.length === 0) return;
        let cardToMove = null;
        if (pileType === 'tableau' && cardIndex === sourcePile.length - 1) {
            cardToMove = sourcePile[cardIndex];
        } else if (pileType === 'waste') {
            cardToMove = sourcePile[sourcePile.length - 1];
        }
        if (!cardToMove) return;
        for (let i = 0; i < 4; i++) {
            if (isValidMove(cardToMove, 'foundation', i)) {
                saveStateForUndo();
                moveCards([cardToMove], pileType, pileIndex, 'foundation', i);
                return;
            }
        }
    }

    // =========================================================================
    // ゲームロジック
    // =========================================================================
    function getPile(type, index) {
        if (type === 'waste') return state.waste;
        if (type === 'stock') return state.stock;
        if (index === undefined) return null;
        if (type === 'tableau') return state.tableau[index];
        if (type === 'foundation') return state.foundations[index];
        return null;
    }

    function isValidMove(cardToMove, toPileType, toPileIndex) {
        if (!cardToMove || toPileType === undefined) return false;
        const toIndex = toPileIndex !== undefined ? parseInt(toPileIndex, 10) : undefined;
        const targetPile = getPile(toPileType, toIndex);
        if (!targetPile) return false;
        if (toPileType === 'foundation') {
            const topCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;
            return topCard ? (cardToMove.suit === topCard.suit && cardToMove.value === topCard.value + 1) : (cardToMove.rank === 'A');
        }
        if (toPileType === 'tableau') {
            const topCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;
            return topCard ? (cardToMove.color !== topCard.color && cardToMove.value === topCard.value - 1) : (cardToMove.rank === 'K');
        }
        return false;
    }
    
    function moveCards(cardsToMove, fromType, fromIndex, toType, toIndex) {
        const fromPile = getPile(fromType, fromIndex);
        const toPile = getPile(toType, toIndex);
        if(!fromPile || !toPile) { if (!isAutocompleting) state.history.pop(); renderAll(); return; }
        
        const cardToFlipBeforeMove = (fromType === 'tableau' && fromPile.length > cardsToMove.length && fromPile.length > 1) ? fromPile[fromPile.length - cardsToMove.length - 1] : null;
        
        const moved = fromPile.splice(fromPile.length - cardsToMove.length, cardsToMove.length);
        toPile.push(...moved);
        
        if (cardToFlipBeforeMove && !cardToFlipBeforeMove.isFaceUp) {
            cardToFlipBeforeMove.isFaceUp = true;
            const cardEl = document.querySelector(`.card[data-id="${cardToFlipBeforeMove.id}"]`);
            if(cardEl) flipCard(cardEl, cardToFlipBeforeMove);
        }
        
        if (!isAutocompleting) {
            state.moves++;
        }
        
        renderAll();
        checkForAutoComplete();
    }
    
    function saveStateForUndo() {
        if (isAutocompleting || isDealing) return;
        const snapshot = JSON.parse(JSON.stringify({
            tableau: state.tableau, foundations: state.foundations,
            stock: state.stock, waste: state.waste, moves: state.moves,
        }));
        state.history.push(snapshot);
        if (state.history.length > 30) state.history.shift();
    }

    function undoMove() {
        if (state.history.length === 0 || isAutocompleting || isDealing) return;
        const prevState = state.history.pop();
        Object.assign(state, prevState); renderAll();
    }
    
    // =========================================================================
    // ヒント機能 & 手詰まり判定
    // =========================================================================
    function findPossibleMoves() {
        const progressiveMoves = [];
        const nonProgressiveMoves = [];
        const wasteCard = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;

        if (wasteCard) {
            for (let i = 0; i < 4; i++) {
                if (isValidMove(wasteCard, 'foundation', i)) {
                    progressiveMoves.push({ from: 'waste', card: wasteCard, toType: 'foundation', toIndex: i });
                }
            }
        }
        for (let i = 0; i < 7; i++) {
            const pile = state.tableau[i];
            if (pile.length > 0) {
                const card = pile[pile.length - 1];
                for (let j = 0; j < 4; j++) {
                    if (isValidMove(card, 'foundation', j)) {
                        progressiveMoves.push({ from: `tableau-${i}`, card, fromCardIndex: pile.length - 1, toType: 'foundation', toIndex: j });
                    }
                }
            }
        }

        for (let i = 0; i < 7; i++) {
            const sourcePile = state.tableau[i];
            for (let j = 0; j < sourcePile.length; j++) {
                if (sourcePile[j].isFaceUp) {
                    const cardsToMove = sourcePile.slice(j);
                    const card = cardsToMove[0];
                    for (let k = 0; k < 7; k++) {
                        if (i === k) continue;
                        if (isValidMove(card, 'tableau', k)) {
                            if (card.rank === 'K' && j === 0) {
                                continue;
                            }
                            const move = { from: `tableau-${i}`, card, fromCardIndex: j, toType: 'tableau', toIndex: k };
                            if (j > 0 && !sourcePile[j - 1].isFaceUp) {
                                progressiveMoves.push(move);
                            } else {
                                nonProgressiveMoves.push(move);
                            }
                        }
                    }
                    break;
                }
            }
        }

        if (wasteCard) {
            for (let i = 0; i < 7; i++) {
                if (isValidMove(wasteCard, 'tableau', i)) {
                    const move = { from: 'waste', card: wasteCard, toType: 'tableau', toIndex: i };
                    if (wasteCard.rank === 'K' && state.tableau[i].length === 0) {
                        progressiveMoves.push(move);
                    } else {
                        nonProgressiveMoves.push(move);
                    }
                }
            }
        }

        const unique = (arr) => [...new Map(arr.map(item => [JSON.stringify(item), item])).values()];
        return { progressive: unique(progressiveMoves), nonProgressive: unique(nonProgressiveMoves) };
    }
    
    function canStockHelp() {
        if (state.stock.length === 0 && state.waste.length === 0) return false;
        if (state.stock.length === 0 && state.waste.length > 0) return true;

        const allTargets = [];
        for (let i = 0; i < 4; i++) allTargets.push({ type: 'foundation', index: i });
        for (let i = 0; i < 7; i++) allTargets.push({ type: 'tableau', index: i });
        
        if (currentGameSettings.drawCount === 1) {
            const checkableCards = [...state.stock, ...state.waste];
            for (const card of checkableCards) {
                for (const target of allTargets) {
                    if (isValidMove(card, target.type, target.index)) return true;
                }
            }
        } else {
            const virtualStock = [...state.stock];
            while (virtualStock.length > 0) {
                const numToDraw = Math.min(virtualStock.length, currentGameSettings.drawCount);
                const exposedCard = virtualStock[virtualStock.length - numToDraw];
                for (const target of allTargets) {
                    if (isValidMove(exposedCard, target.type, target.index)) return true;
                }
                virtualStock.splice(virtualStock.length - numToDraw, numToDraw);
            }
        }
        return false;
    }

    function findHint() {
        if (isAutocompleting || isDealing) return;
        document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
        const { progressive, nonProgressive } = findPossibleMoves();
        
        if (progressive.length > 0) {
            highlightHint(progressive[0]);
            return;
        }
        if (nonProgressive.length > 0) {
            highlightHint(nonProgressive[0]);
            return;
        }
        if (canStockHelp()) {
            stockEl.classList.add('hint');
            return;
        }
        
        stuckModal.style.display = 'flex';
    }

    function highlightHint(hint) {
        if (!hint) return;
        let sourceEl, targetEl;
        if (hint.from === 'waste') {
            sourceEl = wasteEl.querySelector(`.card[data-id="${hint.card.id}"]`);
        } else if (hint.from.startsWith('tableau-')) {
            const fromIndex = parseInt(hint.from.split('-')[1]);
            sourceEl = tableauEl.children[fromIndex].querySelector(`.card[data-id="${hint.card.id}"]`);
        }

        if (hint.toType === 'foundation') {
            targetEl = foundationsEl.children[hint.toIndex];
        } else if (hint.toType === 'tableau') {
            targetEl = tableauEl.children[hint.toIndex].lastElementChild || tableauEl.children[hint.toIndex];
        }
        
        if (sourceEl) sourceEl.classList.add('hint');
        if (targetEl) targetEl.classList.add('hint');
    }

    // =========================================================================
    // オートコンプリート & 勝利アニメーション
    // =========================================================================
    function checkForAutoComplete() {
        if (isAutocompleting || isDealing) return;
        const allTableauCardsFaceUp = state.tableau.every(pile => pile.every(card => card.isFaceUp));
        if (state.stock.length === 0 && state.waste.length === 0 && allTableauCardsFaceUp) {
            autoComplete();
        }
    }

    function autoComplete() {
        isAutocompleting = true;
        updateInfo();

        const interval = setInterval(() => {
            let movedCard = false;
            
            for (let i = 0; i < 7; i++) {
                const pile = state.tableau[i];
                if (pile.length > 0) {
                    const card = pile[pile.length - 1];
                    for (let j = 0; j < 4; j++) {
                        if (isValidMove(card, 'foundation', j)) {
                            moveCards([card], 'tableau', i, 'foundation', j);
                            movedCard = true;
                            return;
                        }
                    }
                }
            }

            const wasteCard = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
            if (wasteCard) {
                for (let j = 0; j < 4; j++) {
                    if (isValidMove(wasteCard, 'foundation', j)) {
                        moveCards([wasteCard], 'waste', undefined, 'foundation', j);
                        movedCard = true;
                        return;
                    }
                }
            }

            if (!movedCard) {
                clearInterval(interval);
                checkWinCondition();
            }
        }, 100);
    }

    function checkWinCondition() {
        if (state.foundations.every(p => p.length === 13)) {
            winGame();
        }
    }

    function winGame() {
        stopTimer();
        isAutocompleting = true;
        updateInfo();
        stats.gamesWon = (stats.gamesWon || 0) + 1;
        updateStatsDisplay();
        finalTimeEl.textContent = timeEl.textContent;
        finalMovesEl.textContent = state.moves;

        startWinAnimation(() => {
            winModal.style.display = 'flex';
        });
    }

    function startWinAnimation(onComplete) {
        const cardsToAnimate = state.foundations.flat();
        state.foundations = [[], [], [], []];
        renderAll();

        const animationCards = [];
        const gravity = 0.1;
        const bounceDampening = 0.7;

        const launchInterval = setInterval(() => {
            if (cardsToAnimate.length === 0) {
                clearInterval(launchInterval);
                return;
            }
            const cardData = cardsToAnimate.pop();
            const winCard = createCardElement(cardData);
            winCard.classList.add('win-animation-card');
            
            const foundationRect = foundationsEl.children[0].getBoundingClientRect();
            
            const cardPhysics = {
                el: winCard,
                x: foundationRect.left,
                y: foundationRect.top,
                vx: (Math.random() - 0.5) * 10,
                vy: -Math.random() * 5 - 5,
            };
            
            winCard.style.transform = `translate(${cardPhysics.x}px, ${cardPhysics.y}px) rotateY(180deg)`;
            gameContainer.appendChild(winCard);
            animationCards.push(cardPhysics);

        }, 80);

        function animate() {
            animationCards.forEach(card => {
                card.vy += gravity;
                card.x += card.vx;
                card.y += card.vy;

                const cardWidth = card.el.offsetWidth;
                const cardHeight = card.el.offsetHeight;

                if (card.x + cardWidth > window.innerWidth || card.x < 0) {
                    card.vx *= -bounceDampening;
                    card.x = Math.max(0, Math.min(card.x, window.innerWidth - cardWidth));
                }
                if (card.y + cardHeight > window.innerHeight) {
                    card.vy *= -bounceDampening;
                    card.y = window.innerHeight - cardHeight;
                }
                card.el.style.transform = `translate(${card.x}px, ${card.y}px) rotateY(180deg)`;
            });
            winAnimationId = requestAnimationFrame(animate);
        }

        winAnimationId = requestAnimationFrame(animate);
        
        setTimeout(() => {
            if (winAnimationId) cancelAnimationFrame(winAnimationId);
            document.querySelectorAll('.win-animation-card').forEach(c => c.remove());
            onComplete();
        }, 7000);
    }

    // =========================================================================
    // UI更新
    // =========================================================================
    function updateInfo() {
        movesEl.textContent = state.moves;
        undoBtn.disabled = state.history.length === 0 || isAutocompleting || isDealing;
        hintBtn.disabled = isAutocompleting || isDealing;
    }

    function startTimer() {
        stopTimer();
        timerInterval = setInterval(() => {
            seconds++; updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
    }

    function updateTimerDisplay() {
        const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timeEl.textContent = `${minutes}:${secs}`;
    }

    function updateStatsDisplay() {
        if (gamesPlayedEl) gamesPlayedEl.textContent = stats.gamesPlayed || 0;
        if (gamesWonEl) gamesWonEl.textContent = stats.gamesWon || 0;
        if (winRateEl && stats.gamesPlayed > 0) {
            winRateEl.textContent = `${Math.round(((stats.gamesWon || 0) / stats.gamesPlayed) * 100)}%`;
        } else if (winRateEl) {
            winRateEl.textContent = 'N/A';
        }
    }

    // =========================================================================
    // 設定関連のイベントリスナ
    // =========================================================================
    newGameBtn.addEventListener('click', startGame);
    winNewGameBtn.addEventListener('click', () => { winModal.style.display = 'none'; startGame(); });
    undoBtn.addEventListener('click', undoMove);
    hintBtn.addEventListener('click', findHint);
    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
    closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    stuckNewGameBtn.addEventListener('click', () => { stuckModal.style.display = 'none'; startGame(); });
    stuckCloseBtn.addEventListener('click', () => { stuckModal.style.display = 'none'; });
    
    drawSelect.addEventListener('change', (e) => {});
    cardBackOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.card-back-option');
        if (!option) return;
        document.querySelectorAll('.card-back-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected'); 
        currentGameSettings.cardBack = option.dataset.back;
        renderAll();
    });

    // =========================================================================
    // 初期実行
    // =========================================================================
    startGame();
});