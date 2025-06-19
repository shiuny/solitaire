document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 定数とDOM要素
    // =========================================================================
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const SUIT_COLORS = { '♠': 'black', '♥': 'red', '♦': 'red', '♣': 'black' };
    const SUIT_CLASS_MAP = { '♠': 'suit-s', '♥': 'suit-h', '♦': 'suit-d', '♣': 'suit-c' };

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

    // =========================================================================
    // ゲーム状態
    // =========================================================================
    let state = {};
    let stats = { gamesPlayed: 0, gamesWon: 0 };
    let settings = { drawCount: 3, cardBack: 'back1' };
    let timerInterval;
    let seconds = 0;
    
    let dragInfo = {
        isDragging: false, element: null, cards: [], from: {},
        offsetX: 0, offsetY: 0, animationFrameId: null
    };

    // =========================================================================
    // ゲーム初期化と進行
    // =========================================================================
    function startGame() {
        stopTimer(); seconds = 0; updateTimerDisplay();
        state = {
            tableau: [[], [], [], [], [], [], []], foundations: [[], [], [], []],
            stock: createAndShuffleDeck(), waste: [], moves: 0, history: [],
        };
        dealCards(); renderAll(); startTimer();
        stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
        updateStatsDisplay();
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

    function dealCards() {
        for (let i = 0; i < 7; i++) {
            for (let j = i; j < 7; j++) {
                if (state.stock.length > 0) state.tableau[j].push(state.stock.pop());
            }
        }
        state.tableau.forEach(pile => {
            if (pile.length > 0) pile[pile.length - 1].isFaceUp = true;
        });
    }

    // =========================================================================
    // レンダリング
    // =========================================================================
    function renderAll() {
        document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
        tableauEl.innerHTML = ''; foundationsEl.innerHTML = ''; stockEl.innerHTML = ''; wasteEl.innerHTML = '';

        state.tableau.forEach((pile, pileIndex) => {
            const pileSlot = createPileSlot('tableau', pileIndex);
            if (pile.length === 0) {
                 tableauEl.appendChild(pileSlot); return;
            }
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
            cardEl.classList.add('facedown', settings.cardBack);
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
        updateInfo(); checkWinCondition();
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
            if (card.rank === '10') {
                cardEl.classList.add('is-rank-10');
            }
            const suitClassName = SUIT_CLASS_MAP[card.suit];
            cardEl.innerHTML = `
                <div class="card-top"><span class="card-rank">${card.rank}</span><span class="card-suit ${suitClassName}"></span></div>
                <div class="card-bottom"><span class="card-rank">${card.rank}</span><span class="card-suit ${suitClassName}"></span></div>`;
        } else {
            cardEl.classList.add('facedown', settings.cardBack);
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
        if (dragInfo.isDragging) return;
        saveStateForUndo();
        if (state.stock.length > 0) {
            const count = Math.min(state.stock.length, settings.drawCount);
            for (let i = 0; i < count; i++) {
                if(state.stock.length === 0) break;
                const card = state.stock.pop();
                card.isFaceUp = true; state.waste.push(card);
            }
        } else if (state.waste.length > 0) {
            state.stock.push(...state.waste.reverse());
            state.stock.forEach(c => c.isFaceUp = false); state.waste = [];
        } else {
            state.history.pop(); return;
        }
        state.moves++; renderAll();
    }

    function handleInteractionStart(e) {
        if (e.type === 'mousedown' && e.button !== 0) return;
        if (dragInfo.isDragging) return;
        
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
            // ★★★ PCでのテキスト選択とスマホでのスクロールを両方防ぐ ★★★
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

            if (dragInfo.isDragging) {
                finishDrag();
            }
            dragInfo.isDragging = false;
        };

        document.addEventListener('mousemove', onInteractionMove);
        document.addEventListener('mouseup', onInteractionEnd);
        document.addEventListener('touchmove', onInteractionMove, { passive: false });
        document.addEventListener('touchend', onInteractionEnd);
    }
    
    function initiateDrag(startEvent, baseEl, cards, pileType, pileIndex) {
        saveStateForUndo();
        // ★★★ ドラッグ開始時にクラスを付与 ★★★
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
        // ★★★ ドラッグ終了時にクラスを削除 ★★★
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
            
            if (pileType === dragInfo.from.type && pileIndex === dragInfo.from.index) {
                return;
            }

            const pile = getPile(pileType, pileIndex);
            let targetEl = slotEl.lastElementChild || slotEl;
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
            return topCard
                ? (cardToMove.suit === topCard.suit && cardToMove.value === topCard.value + 1)
                : (cardToMove.rank === 'A');
        }
        if (toPileType === 'tableau') {
            const topCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : null;
            return topCard
                ? (cardToMove.color !== topCard.color && cardToMove.value === topCard.value - 1)
                : (cardToMove.rank === 'K');
        }
        return false;
    }
    
    function moveCards(cardsToMove, fromType, fromIndex, toType, toIndex) {
        const fromPile = getPile(fromType, fromIndex);
        const toPile = getPile(toType, toIndex);
        if(!fromPile || !toPile) {
            state.history.pop();
            renderAll();
            return;
        }
        
        const moved = fromPile.splice(fromPile.length - cardsToMove.length, cardsToMove.length);
        toPile.push(...moved);
        
        if (fromType === 'tableau' && fromPile.length > 0 && !fromPile[fromPile.length - 1].isFaceUp) {
            fromPile[fromPile.length - 1].isFaceUp = true;
        }

        state.moves++; renderAll();
    }
    
    function saveStateForUndo() {
        const snapshot = JSON.parse(JSON.stringify({
            tableau: state.tableau, foundations: state.foundations,
            stock: state.stock, waste: state.waste, moves: state.moves,
        }));
        state.history.push(snapshot);
        if (state.history.length > 30) state.history.shift();
    }

    function undoMove() {
        if (state.history.length === 0) return;
        const prevState = state.history.pop();
        Object.assign(state, prevState); renderAll();
    }
    
    // =========================================================================
    // ヒント機能
    // =========================================================================
    function highlightHint(sourceEl, targetEl) {
        if (sourceEl) sourceEl.classList.add('hint');
        if (targetEl) targetEl.classList.add('hint');
    }

    function findHint() {
        document.querySelectorAll('.hint').forEach(el => el.classList.remove('hint'));
        const wasteCard = state.waste.length > 0 ? state.waste[state.waste.length - 1] : null;
        if (wasteCard) {
            for (let i = 0; i < 4; i++) {
                if (isValidMove(wasteCard, 'foundation', i)) {
                    highlightHint(wasteEl.querySelector(`.card[data-id="${wasteCard.id}"]`), foundationsEl.children[i]);
                    return;
                }
            }
        }
        for (let i = 0; i < 7; i++) {
            const pile = state.tableau[i];
            if (pile.length > 0) {
                const card = pile[pile.length - 1];
                for (let j = 0; j < 4; j++) {
                    if (isValidMove(card, 'foundation', j)) {
                        highlightHint(tableauEl.children[i].querySelector(`.card[data-id="${card.id}"]`), foundationsEl.children[j]);
                        return;
                    }
                }
            }
        }
        for (let i = 0; i < 7; i++) {
            const sourcePile = state.tableau[i];
            for (let j = 0; j < sourcePile.length; j++) {
                const card = sourcePile[j];
                if (card.isFaceUp && j > 0 && !sourcePile[j - 1].isFaceUp) {
                    for (let k = 0; k < 7; k++) {
                        if (i === k) continue;
                        if (isValidMove(card, 'tableau', k)) {
                            highlightHint(tableauEl.children[i].querySelector(`.card[data-id="${card.id}"]`), tableauEl.children[k]);
                            return;
                        }
                    }
                }
            }
        }
        for (let i = 0; i < 7; i++) {
            const sourcePile = state.tableau[i];
            for (let j = 0; j < sourcePile.length; j++) {
                const card = sourcePile[j];
                if (card.isFaceUp) {
                    for (let k = 0; k < 7; k++) {
                        if (i === k) continue;
                        if (isValidMove(card, 'tableau', k)) {
                            highlightHint(tableauEl.children[i].querySelector(`.card[data-id="${card.id}"]`), tableauEl.children[k]);
                            return;
                        }
                    }
                }
            }
        }
        if (wasteCard) {
            for (let i = 0; i < 7; i++) {
                if (isValidMove(wasteCard, 'tableau', i)) {
                    highlightHint(wasteEl.querySelector(`.card[data-id="${wasteCard.id}"]`), tableauEl.children[i]);
                    return;
                }
            }
        }
        if (state.stock.length > 0) {
            highlightHint(stockEl, null);
            return;
        }
        alert("ヒントはありません。");
    }

    // =========================================================================
    // 勝利判定とUI更新
    // =========================================================================
    function checkWinCondition() {
        if (state.foundations.every(p => p.length === 13)) { winGame(); }
    }

    function winGame() {
        stopTimer();
        stats.gamesWon = (stats.gamesWon || 0) + 1;
        updateStatsDisplay();
        finalTimeEl.textContent = timeEl.textContent;
        finalMovesEl.textContent = state.moves;
        winModal.style.display = 'flex';
    }

    function updateInfo() {
        movesEl.textContent = state.moves;
        undoBtn.disabled = state.history.length === 0;
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
    winNewGameBtn.addEventListener('click', () => {
        winModal.style.display = 'none'; startGame();
    });
    undoBtn.addEventListener('click', undoMove);
    hintBtn.addEventListener('click', findHint);
    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
    closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
    
    drawSelect.addEventListener('change', (e) => settings.drawCount = parseInt(e.target.value, 10));
    
    cardBackOptions.addEventListener('click', (e) => {
        const option = e.target.closest('.card-back-option');
        if (!option) return;
        settings.cardBack = option.dataset.back;
        document.querySelectorAll('.card-back-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected'); renderAll();
    });

    // =========================================================================
    // 初期実行
    // =========================================================================
    startGame();
});