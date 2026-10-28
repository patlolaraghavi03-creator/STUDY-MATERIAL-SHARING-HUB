const express = require('express');
const cors = require('cors');
require('dotenv').config();
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// GET: Retrieve all study materials
app.get('/api/materials', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('study_materials')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching materials:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET: Retrieve single study material by ID
app.get('/api/materials/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('study_materials')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Material not found' });

        res.status(200).json(data);
    } catch (err) {
        console.error('Error fetching material:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST: Create a new study material
app.post('/api/materials', async (req, res) => {
    try {
        const { title, subject, category, author, file_url, description } = req.body;

        if (!title || !subject || !category || !author || !file_url) {
            return res.status(400).json({ error: 'Missing required fields: title, subject, category, author, file_url' });
        }

        const { data, error } = await supabase
            .from('study_materials')
            .insert([{ title, subject, category, author, file_url, description }])
            .select();

        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        console.error('Error creating material:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// PUT: Update an existing study material
app.put('/api/materials/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, subject, category, author, file_url, description } = req.body;

        const { data, error } = await supabase
            .from('study_materials')
            .update({ title, subject, category, author, file_url, description, updated_at: new Date() })
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: 'Material not found' });

        res.status(200).json(data[0]);
    } catch (err) {
        console.error('Error updating material:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove a study material
app.delete('/api/materials/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('study_materials')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;
        if (!data || data.length === 0) return res.status(404).json({ error: 'Material not found' });

        res.status(200).json({ message: 'Material deleted successfully', id });
    } catch (err) {
        console.error('Error deleting material:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});