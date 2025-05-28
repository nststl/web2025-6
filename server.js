const {program} = require('commander');
const fs = require('fs').promises;
const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const http = require('http');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');


program 
.option('-h, --host, <host>', 'адреса сервера')
.option('-p, --port, <port>', 'порт сервера')
.option('-c, --cache, <cache>', 'кешовані файли')

.parse(process.argv);

const options = program.opts();

if (!options.host || !options.port || !options.cache) {
  console.error('Missing required parameters');
  process.exit(1);
}

app.use(express.text());

const notesDir = options.cache;

const upload = multer();

/**
 * @swagger
 * /notes/{name}:
 *   get:
 *     summary: Отримати нотатку по імені
 *     parameters:
 *       - in: path
 *         name: name
 *         schema:
 *           type: string
 *         required: true
 *         description: Ім'я нотатки (наприклад, test.txt)
 *     responses:
 *       200:
 *         description: Нотатка знайдена
 *       404:
 *         description: Нотатка не знайдена
 */


app.get('/notes/:name', (req, res) => {
  const noteName = req.params.name;
  const notePath = path.join(options.cache, `${noteName}.txt`);

  fs.readFile(notePath, 'utf-8')
    .then(data => {
      res.status(200).type('text/plain').send(data);
    })
    .catch(err => {
      if (err.code === 'ENOENT') {
        res.status(404).send('Not found');
      } else{
        res.status(500).send('Server error');
      }

    });
});

/**
 * @swagger
 * /notes/{name}:
 *   put:
 *     summary: Оновити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Ім'я нотатки
 *     requestBody:
 *       required: true
 *       content:
 *         text/plain:
 *           schema:
 *             type: string
 *             example: Текст нотатки
 *     responses:
 *       200:
 *         description: Нотатку оновлено
 *       404:
 *         description: Нотатку не знайдено
 */


app.put('/notes/:name', (req, res) => {
    const noteName = req.params.name;
    const notePath = path.join(options.cache, `${noteName}.txt`);

    fs.access(notePath)
       .then(()=>{
        return fs.writeFile(notePath, req.body);
       })
       .then (()=>{
        res.status(200).send('success');
       })
       .catch(err =>{
        if (err.code === 'ENOENT'){
            res.status(404).send('Not found');
        } else {
            res.status(500).send('Server error');
        }
       });
});

/**
 * @swagger
 * /notes/{name}:
 *   delete:
 *     summary: Видалити нотатку
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: Ім'я нотатки
 *     responses:
 *       200:
 *         description: Видалено успішно
 *       404:
 *         description: Нотатку не знайдено
 */


app.delete('/notes/:name', (req,res) => {
    const noteName = req.params.name;
    const notePath = path.join(options.cache, `${noteName}.txt`);

    fs.unlink(notePath)
    .then (() => {
        res.status(200).send('deleted');
    })
    .catch(err => {
        if (err.code === 'ENOENT'){
            res.status(404).send('Not found');
        }else{
            res.status(500).send('Server error');
        }

    })
});

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Отримати всі нотатки
 *     responses:
 *       200:
 *         description: Список нотаток
 */


app.get('/notes', async (req, res) => {
  try {
    const files = (await fs.readdir(notesDir)).filter(file => file.endsWith('.txt'));
    const notes = await Promise.all(files.map(async file => {
      try {
        const text = await fs.readFile(path.join(notesDir, file), 'utf8');
        return { name: path.basename(file, '.txt'), text };
      } catch {
        return null;
      }
    }));

    res.status(200).json(notes.filter(Boolean));
  } catch (err) {
    console.error('Error reading notes:', err);
    res.status(500).send('Server error');
  }
});

/**
 * @swagger
 * /write:
 *   post:
 *     summary: Створити нову нотатку через HTML-форму
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               note_name:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Нотатка створена
 *       400:
 *         description: Нотатка вже існує
 */


app.post('/write', upload.none(), (req, res) => {
    const { note_name, note } = req.body;
    const filePath = path.join(notesDir, `${note_name}.txt`);

    fs.access(filePath)
  .then(() => {
    res.status(400).send('A note with that name already exists.');
  })
  .catch(() => {
    fs.writeFile(filePath, note)
      .then(() => res.status(201).send('The note was successfully created!'))
      .catch(() => res.status(500).send('Server error.'));
  });
});

app.get('/UploadForm.html', (req, res) => {
    const htmlForm = `
        <!DOCTYPE html>
        <html lang="uk">
        <head>
            <meta charset="UTF-8">
            <title>Завантаження нотатки</title>
        </head>
        <body>
            <h2>Додати нову нотатку</h2>
            <form action="/write" method="POST" enctype="multipart/form-data">
                <label for="note_name">Ім'я нотатки:</label>
                <input type="text" name="note_name" required><br>
                <label for="note">Текст нотатки:</label>
                <textarea name="note" required></textarea><br>
                <button type="submit">Зберегти нотатку</button>
            </form>
        </body>
        </html>
    `;
    res.status(200).send(htmlForm);
});


const server = http.createServer(app);

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Notes API',
      version: '1.0.0',
      description: 'API для роботи з нотатками',
    },
  },
  apis: ['./server.js'], // Файл із документацією
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));


server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
