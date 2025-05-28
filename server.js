const {program} = require('commander');
const fs = require('fs').promises;
const express = require('express');
const app = express();
const path = require('path');
const multer = require('multer');
const http = require('http');

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

server.listen(options.port, options.host, () => {
  console.log(`Server running at http://${options.host}:${options.port}`);
});
