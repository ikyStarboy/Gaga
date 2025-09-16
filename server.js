const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { fileTypeFromBuffer } = require("file-type");
const fs = require("fs");

const app = express();

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.static("public"));

const validFilters = ["coklat", "hitam", "nerd", "piggy", "carbon", "botak"];

// Ganti dengan API key ImgBB Anda
const IMGBB_API_KEY = "a12e3657b8edd041c13eda8c12ff5925";

app.post("/process", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "File tidak ditemukan." });
    }

    try {
        const fileBuffer = req.file.buffer;

        const type = await fileTypeFromBuffer(fileBuffer);
        if (!type) {
            return res.status(400).json({ error: "File tidak valid!" });
        }

        // Upload ke Ryzen CDN
        const form = new FormData();
        form.append("file", fileBuffer, {
            filename: `upload.${type.ext}`,
            contentType: type.mime,
        });

        const cdnRes = await axios.post(
            "https://api.ryzumi.vip/api/uploader/ryzencdn",
            form,
            { headers: form.getHeaders() }
        );

        if (!cdnRes.data.success) {
            return res.status(500).json({ error: "Gagal upload ke RyzenCDN!" });
        }

        const imageUrl = cdnRes.data.url;

        const filter = (req.query.filter || "coklat").toLowerCase();
        if (!validFilters.includes(filter)) {
            return res
                .status(400)
                .json({ error: `Filter tidak valid. Pilihan: ${validFilters.join(", ")}` });
        }

        // Request ke API recolor Ryzen dan dapatkan hasilnya sebagai buffer
        const aiRes = await axios.get(
            "https://api.ryzumi.vip/api/ai/negro",
            {
                params: { url: imageUrl, filter: filter },
                responseType: "arraybuffer",
            }
        );

        // Langsung unggah buffer hasil ke ImgBB
        const imgbbForm = new FormData();
        imgbbForm.append("image", aiRes.data.toString("base64"));

        const imgbbRes = await axios.post(
            `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
            imgbbForm,
            { headers: imgbbForm.getHeaders() }
        );

        if (imgbbRes.data.success) {
            // Jika berhasil, kirim URL ImgBB sebagai respons
            res.json({ image: imgbbRes.data.data.url });
        } else {
            // Jika gagal, kirim pesan error dari ImgBB
            res.status(500).json({ error: "Gagal mengunggah ke ImgBB." });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Terjadi kesalahan server." });
    }
});

app.listen(3000, () =>
    console.log("✅ Server jalan di http://localhost:3000")
);
