require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const PDFDocument = require('pdfkit');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🔥 Guruh username (majburiy a’zolik uchun)
const GROUP_ID = "@tabrik_uchun_m";
const GROUP_URL = "https://t.me/tabrik_uchun_m";

// Har bir foydalanuvchi uchun vaqtincha rasm ro'yxati
let userImages = {};

// 🔥 Guruhga a'zolikni tekshiruvchi funksiya
async function checkMembership(ctx) {
    try {
        const member = await ctx.telegram.getChatMember(GROUP_ID, ctx.from.id);
        if (["member", "creator", "administrator"].includes(member.status)) {
            return true; // ✅ A'zo
        } else {
            return false; // ❌ A'zo emas
        }
    } catch (err) {
        console.error("❌ Guruhni tekshirishda xatolik:", err.message);
        return false;
    }
}

// 🔥 A'zo bo'lmaganlarga xabar
function mustJoinMessage(ctx) {
    return ctx.reply(
        "Botdan foydalanish uchun avval rasmiy guruhga a'zo bo'ling❗️",
        Markup.inlineKeyboard([
            [Markup.button.url("👉 Guruhga qo'shilish", GROUP_URL)],
            [Markup.button.callback("✅ A'zo bo'ldim", "check_membership")]
        ])
    );
}

// 📌 Callback: "✅ A’zo bo'ldim"
bot.action("check_membership", async (ctx) => {
    const isMember = await checkMembership(ctx);

    if (!isMember) {
        await ctx.answerCbQuery("❌ Siz hali guruhga qo'shilmadingiz!", { show_alert: true });
        return mustJoinMessage(ctx);
    }

    await ctx.answerCbQuery(); 
    ctx.reply("Tabriklaymiz, Botimizdan bemalol foydalanishingiz mumkin ✅✅ /start ni qayta jo'nating");
});

// Rasmni yuklab olish va faylga yozish
const downloadImage = async (url, filePath) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// 📍 /start buyrug'i
bot.start(async (ctx) => {
    const isMember = await checkMembership(ctx);

    if (!isMember) {
        return mustJoinMessage(ctx);
    }

    ctx.reply(
        "👋 Salom! Men rasmlarni PDF ga aylantiradigan botman.\n\n" +
        "1️⃣ Avval 📸 rasm yuboring\n" +
        "2️⃣ Keyin 📄 PDF yaratish tugmasini bosing\n" +
        "3️⃣ Men sizga tayyor PDFni yuboraman",
        Markup.keyboard([
            ['📸 Rasm yuborish', '📄 PDF yaratish'],
            ['🔄 Tozalash', 'ℹ️ Yordam']
        ]).resize()
    );
});

// 📸 Rasm yuborish
bot.on('photo', async (ctx) => {
    const userId = ctx.from.id;
    const isMember = await checkMembership(ctx);

    if (!isMember) {
        return mustJoinMessage(ctx);
    }

    const photo = ctx.message.photo.pop();
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);

    const fileName = `image_${userId}_${Date.now()}.jpg`;
    const filePath = path.join(__dirname, fileName);

    try {
        await downloadImage(fileLink.href, filePath);

        if (!userImages[userId]) {
            userImages[userId] = [];
        }

        userImages[userId].push(filePath);

        ctx.reply("✅ Rasm qabul qilindi. Yana rasm yuboring yoki 📄 PDF yaratish tugmasini bosing.");
    } catch (error) {
        console.error("❌ Rasm yuklashda xatolik:", error.message);
        ctx.reply("⚠️ Rasmni yuklab bo'lmadi. Qayta urinib ko'ring.");
    }
});

// 📄 PDF yaratish
bot.hears('📄 PDF yaratish', async (ctx) => {
    const userId = ctx.from.id;
    const isMember = await checkMembership(ctx);

    if (!isMember) {
        return mustJoinMessage(ctx);
    }

    const images = userImages[userId];

    if (!images || images.length === 0) {
        return ctx.reply("❗️ Siz hali hech qanday rasm yubormadingiz.");
    }

    const pdfPath = path.join(__dirname, `output_${userId}_${Date.now()}.pdf`);
    const doc = new PDFDocument({ autoFirstPage: false });
    const stream = fs.createWriteStream(pdfPath);

    doc.pipe(stream);

    for (const imgPath of images) {
        const img = doc.openImage(fs.readFileSync(imgPath));
        doc.addPage({ size: [img.width, img.height] });
        doc.image(img, 0, 0);
    }

    doc.end();

    stream.on('finish', async () => {
        try {
            await ctx.replyWithDocument({ source: pdfPath, filename: `converted_${Date.now()}.pdf` });
        } catch (err) {
            console.error("❌ PDF yuborishda xatolik:", err.message);
            await ctx.reply("❌ PDF faylni yuborishda xatolik yuz berdi.");
        }

        // 🧹 Fayllarni tozalash
        images.forEach((img) => fs.unlinkSync(img));
        fs.unlinkSync(pdfPath);
        delete userImages[userId];
    });
});

// 🔄 Tozalash
bot.hears('🔄 Tozalash', async (ctx) => {
    const isMember = await checkMembership(ctx);
    if (!isMember) {
        return mustJoinMessage(ctx);
    }

    const userId = ctx.from.id;
    if (userImages[userId] && userImages[userId].length > 0) {
        userImages[userId].forEach((img) => fs.unlinkSync(img));
        delete userImages[userId];
        ctx.reply("🧹 Saqlangan rasm(lar) tozalandi.");
    } else {
        ctx.reply("❗️ Hech qanday saqlangan rasm yo'q.");
    }
});

// ℹ️ Yordam
bot.hears('ℹ️ Yordam', async (ctx) => {
    const isMember = await checkMembership(ctx);
    if (!isMember) {
        return mustJoinMessage(ctx);
    }

    ctx.reply(
        "📘 Yordam:\n\n" +
        "1. 📸 Rasm yuboring — bir yoki bir nechta\n" +
        "2. 📄 PDF yaratish tugmasini bosing\n" +
        "3. Bot sizga PDF faylni yuboradi\n" +
        "4. 🔄 Tozalash — saqlangan rasm(lar)ni o'chirish\n\n" +
        "5. ✅ A’zo bo'ldim tugmasi orqali a’zolikni tekshirish"
    );
});

// 📸 Rasm yuborish tugmasi
bot.hears('📸 Rasm yuborish', async (ctx) => {
    const isMember = await checkMembership(ctx);
    if (!isMember) {
        return mustJoinMessage(ctx);
    }

    ctx.reply("📸 Iltimos, rasm yuboring.");
});

// ▶️ Botni ishga tushurish
bot.launch().then(() => {
    console.log("🤖 Bot ishga tushdi...");
});
