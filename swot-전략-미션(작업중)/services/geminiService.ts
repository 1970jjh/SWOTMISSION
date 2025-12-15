
import { GoogleGenAI } from "@google/genai";
import { Room, Team, Match, CARDS } from "../types";

const getAI = () => {
    if (!process.env.API_KEY) throw new Error("API Key is missing");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateSWOTAnalysis = async (room: Room): Promise<string> => {
    const ai = getAI();

    // Helper function to calculate rounds won from match history
    const getTeamRoundsWon = (teamId: string): { count: number, rounds: number[] } => {
        const wonRounds: number[] = [];
        room.matches.forEach(match => {
            const isTeamA = match.teamAId === teamId;
            const isTeamB = match.teamBId === teamId;
            if (!isTeamA && !isTeamB) return;
            match.history?.forEach(h => {
                const teamWon = (isTeamA && (h.result === 'A_WON' || h.result === 'B_FOLDED')) ||
                               (isTeamB && (h.result === 'B_WON' || h.result === 'A_FOLDED'));
                if (teamWon) {
                    wonRounds.push(h.round);
                }
            });
        });
        return { count: wonRounds.length, rounds: wonRounds.sort((a, b) => a - b) };
    };

    // Construct prompt with game data (including actual rounds won)
    const teamData = room.teams.map(t => {
        const roundsData = getTeamRoundsWon(t.id);
        const roundsWonStr = roundsData.count > 0
            ? `${roundsData.count}승 (R${roundsData.rounds.join(', R')})`
            : '0승';
        return `Team: ${t.name}, Winnings(Total Chips): ${t.winnings}억, Rounds Won: ${roundsWonStr}, Strategy Pattern: ${t.strategy?.map(r => `[R${r.round}:Card${r.card}/Chip${r.chips}]`).join(' ')}`;
    }).join('\n');

    // Include match history for more accurate analysis
    const matchHistory = room.matches.map((match, idx) => {
        const teamA = room.teams.find(t => t.id === match.teamAId);
        const teamB = room.teams.find(t => t.id === match.teamBId);
        const historyStr = match.history?.map(h =>
            `R${h.round}: ${teamA?.name}(Card ${h.teamACard}, Chip ${h.teamAChips}) vs ${teamB?.name}(Card ${h.teamBCard}, Chip ${h.teamBChips}) → ${h.result}, Pot: ${h.potWon}억`
        ).join('\n') || 'No history';
        return `Match ${idx + 1}: ${teamA?.name} vs ${teamB?.name}\n${historyStr}`;
    }).join('\n\n');

    const prompt = `
    You are a Strategic Management Consultant & Comedy Writer.
    Analyze the gameplay data of the following teams in a "Resource Allocation Strategy Game".

    **Game Rules**:
    - Resources: 0-9 Number Cards, 30 Chips.
    - Goal: Win rounds by playing higher cards or managing chip betting.
    - Each round, teams bet chips. Higher card wins the pot. If cards are equal, pot carries over.
    - Teams can FOLD (forfeit round) or CALL (compete).

    **Team Summary**:
    ${teamData}

    **Detailed Match History**:
    ${matchHistory}

    **Task**:
    Provide a feedback report in Korean.

    **CRITICAL FORMATTING RULES**:
    1. **DO NOT USE MARKDOWN SYMBOLS** like **, *, #, ##, -, *.
    2. Instead, use HTML tags for styling:
       - Use <h3>Title</h3> for section headers.
       - Use <span style="color:#fbbf24; font-weight:bold;">text</span> for emphasis (Golden yellow).
       - Use <span style="background-color:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">text</span> for highlights.
       - Use <br> for line breaks.
       - Use <div style="margin-bottom:16px;"> for spacing.

    **Content Requirements**:
    1. **Part 1: Team SWOT Analysis**: For each team, provide Strengths(강점), Weaknesses(약점), Opportunities(기회), Threats(위협). Be professional but concise. Reference specific rounds and strategies.
    2. **Part 2: Comprehensive Comic Analysis (종합 분석 - 코믹 버전)**:
       - Write a *very funny, witty, and humorous* summary of the entire game.
       - Reference actual round results and winning/losing moments.
       - Make fun of teams who bluffed and failed, or praised lucky winners.
       - Use emojis liberally.
       - Title this section as <h3 style="color:#34d399; border-bottom: 2px solid #34d399; padding-bottom: 5px; margin-top: 30px;">🤣 종합 분석 결과 (Comic Ver.)</h3>

    Font family should be 'Noto Sans KR'.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { systemInstruction: "Analyze game strategies and provide HTML formatted SWOT feedback without Markdown symbols." }
    });

    return response.text || "분석을 생성할 수 없습니다.";
};

export const getGameAdvice = async (team: Team, opponent: Team, match: Match): Promise<string> => {
    const ai = getAI();

    const currentRound = match.currentRound;
    const myStrat = team.strategy![currentRound - 1];
    const oppStrat = opponent.strategy![currentRound - 1];
    
    // Calculate knowns
    const myUsedCards = team.strategy!.slice(0, currentRound - 1).map(s => s.card);
    const oppUsedCards = opponent.strategy!.slice(0, currentRound - 1).map(s => s.card); 
    const oppRemaining = CARDS.filter(c => !oppUsedCards.includes(c));

    const prompt = `
    You are a "Gemini Strategy Advisor" for the game "The Genius".
    Current Round: ${currentRound} / 10
    
    **My Status (${team.name})**:
    - Current Card: ${myStrat.card}
    - Current Bet: ${myStrat.chips}
    
    **Opponent Status (${opponent.name})**:
    - Current Bet: ${oppStrat.chips}
    - Card Color: ${oppStrat.card % 2 === 0 ? "Black" : "White"}
    
    **Task**:
    Provide strategic advice in Korean.
    
    **CRITICAL RULES**:
    1. **NO MARKDOWN**. Do not use **bold** or *italics*.
    2. Provide exactly **3 points** of analysis.
    3. Be decisive: Start with "추천: 포기" or "추천: 승부".
    4. Keep it concise.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: { systemInstruction: "You are a genius game strategist. No Markdown." }
    });

    return response.text || "조언을 가져올 수 없습니다.";
};

export const generateWinnerPoster = async (winnerTeam: Team, base64Photos?: string[], memberNames?: string): Promise<string> => {
    const ai = getAI();

    const memberNamesDisplay = memberNames ? memberNames : winnerTeam.members?.join(', ') || '';
    const namesInstruction = memberNamesDisplay
        ? `**IMPORTANT - Member Names Display**: Show the team member names "${memberNamesDisplay}" prominently on the poster, either below the team name or as individual name tags near each person.`
        : "";

    if (base64Photos && base64Photos.length > 0) {
        // Use Gemini 3.0 Pro Image Preview for high quality generation with reference image
        const prompt = `
        You are a world-class movie poster designer. Create a cinematic winner poster.

        **CORE INSTRUCTION**:
        The user has provided reference images of people. You MUST composite the *actual faces* from these images onto the characters in the poster.
        Maintain their facial identity and expressions as much as possible while blending them into the scene.

        **Subject**: The winning team "${winnerTeam.name}".
        **Style**: Epic Blockbuster, Cyberpunk Gold & Neon Blue, High Contrast, Victory, Glory.

        **Composition**:
        - Center: The team members (using the provided faces) standing triumphantly.
        - Background: A futuristic arena with falling golden confetti and spotlights.
        - Typography at TOP: Large, bold, metallic 3D text "WINNER".
        - Typography at CENTER-BOTTOM: Team name "${winnerTeam.name}" in large gold text.
        - Typography BELOW team name: "Prize: ${winnerTeam.winnings}억"
        ${namesInstruction}

        **Technical**:
        - Photorealistic, 8k resolution, detailed texture.
        - Lighting: Dramatic rim lighting matching the cyberpunk theme.
        - Make sure ALL text is clearly readable.
        `;
        
        try {
            const parts: any[] = [];
            // Add all photos as parts
            base64Photos.forEach(photo => {
                parts.push({ inlineData: { mimeType: 'image/png', data: photo.split(',')[1] } });
            });
            // Add prompt
            parts.push({ text: prompt });

           const response = await ai.models.generateContent({
             model: 'gemini-3-pro-image-preview',
             contents: { parts },
             config: {
                 imageConfig: {
                     aspectRatio: "3:4",
                     imageSize: "1K"
                 }
             }
           });
           
           const resParts = response.candidates?.[0]?.content?.parts;
           if (resParts) {
               for (const part of resParts) {
                   if (part.inlineData) {
                       return `data:image/png;base64,${part.inlineData.data}`;
                   }
               }
           }
        } catch (e) {
            console.error("Poster gen failed", e);
        }
    } 
    
    // Fallback if no photo or error
    const prompt = `
        Generate a high-quality victorious esports style poster for the team "${winnerTeam.name}".

        **Required Text to Display**:
        - "WINNER" (large, at top)
        - Team Name: "${winnerTeam.name}" (prominent, centered)
        - Prize Amount: "${winnerTeam.winnings}억"
        ${memberNamesDisplay ? `- Team Members: "${memberNamesDisplay}" (displayed below team name)` : ''}

        **Style**: Strategy Game Victory, Gold Trophy, Dark Blue Background, Neon Lights, Epic Glory.
        Make sure ALL text is clearly readable.
    `;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: prompt
    });
    
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    
    return "";
};
