require('dotenv').config();
const axios = require('axios');

const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const processedMints = new Set();

async function sendTelegramAlert(mintAddress, owner, signature) {
    const solscanUrl = `https://solscan.io/tx/${signature}`;
    const message = `🚀 *New Token Minted on Solana!* 🚀\n\n`
        + `🔹 *Mint Address:* \`${mintAddress}\`\n`
        + `🔹 *Owner:* \`${owner}\`\n`
        + `🔹 *Transaction:* [View on Solscan](${solscanUrl})`;

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown"
    });
}

async function getRecentTransactions() {
    const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", { limit: 10 }]
    };
    const response = await axios.post(SOLANA_RPC_URL, payload);
    return response.data.result || [];
}

async function getTransactionDetails(signature) {
    const payload = {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, "jsonParsed"]
    };
    const response = await axios.post(SOLANA_RPC_URL, payload);
    return response.data.result || {};
}

async function monitorSolana() {
    console.log("🚀 Solana Token Mint Alert System Running...");
    while (true) {
        try {
            const transactions = await getRecentTransactions();
            for (const tx of transactions) {
                const signature = tx.signature;
                if (!processedMints.has(signature)) {
                    const details = await getTransactionDetails(signature);
                    const instructions = details.transaction?.message?.instructions || [];

                    for (const instr of instructions) {
                        if (instr.program === "spl-token" && instr.parsed?.type === "mintTo") {
                            const mintAddress = instr.parsed.info.mint;
                            const owner = instr.parsed.info.owner || "Unknown";

                            await sendTelegramAlert(mintAddress, owner, signature);
                            processedMints.add(signature);
                        }
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds before next check
        } catch (error) {
            console.error("Error:", error);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
        }
    }
}

monitorSolana();
