
import { GoogleGenAI } from "@google/genai";
import { Room, Team, Match, CARDS } from "../types";

const getAI = () => {
    if (!process.env.API_KEY) throw new Error("API Key is missing");
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateSWOTAnalysis = async (room: Room): Promise<string> => {
    const ai = getAI();
    
    // Construct prompt with game data
    const teamData = room.teams.map(t => {
        return `Team: ${t.name}, Winnings(Total Chips): ${t.winnings}, Rounds Won: ${t.score}, Strategy Pattern: ${t.strategy?.map(r => `[R${r.round}:Card${r.card}/Chip${r.chips}]`).join(' ')}`;
    }).join('\n');

    const prompt = `
    You are a Strategic Management Consultant & Comedy Writer.
    Analyze the gameplay data of the following teams in a "Resource Allocation Strategy Game".
    
    **Game Rules**:
    - Resources: 0-9 Number Cards, 30 Chips.
    - Goal: Win rounds by playing higher cards or managing chip betting.
    
    **Team Data**:
    ${teamData}
    
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
    1. **Part 1: Team SWOT Analysis**: For each team, provide Strengths(강점), Weaknesses(약점), Opportunities(기회), Threats(위협). Be professional but concise.
    2. **Part 2: Comprehensive Comic Analysis (종합 분석 - 코믹 버전)**: 
       - Write a *very funny, witty, and humorous* summary of the entire game. 
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
    
    const namesText = memberNames ? `Team Members: ${memberNames}` : "";

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
        - Typography: Large, bold, metallic 3D text "WINNER" at the top, and "${winnerTeam.name}" at the bottom.
        - Overlay Text: "Total Prize: ${winnerTeam.winnings}억"
        - ${namesText}
        
        **Technical**:
        - Photorealistic, 8k resolution, detailed texture.
        - Lighting: Dramatic rim lighting matching the cyberpunk theme.
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
        Text to include: "${winnerTeam.name}" and "WINNER".
        ${namesText}
        Themes: Strategy, Success, Gold Trophy, Dark Blue Background, Neon Lights.
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
