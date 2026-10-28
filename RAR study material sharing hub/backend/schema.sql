-- Study Material Sharing Hub Database Schema

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create study_materials table
create table if not exists public.study_materials (
    id uuid default gen_random_uuid() primary key,
    title varchar(255) not null,
    subject varchar(100) not null,
    category varchar(50) not null,
    author varchar(100) not null,
    file_url text not null,
    description text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create index on subject and category for fast searching
create index if not exists idx_study_materials_subject on public.study_materials(subject);
create index if not exists idx_study_materials_category on public.study_materials(category);

-- Enable Row Level Security (RLS)
alter table public.study_materials enable row level security;

-- Policy: Allow public read access to all study materials
create policy "Allow public read access"
    on public.study_materials
    for select
    using (true);

-- Policy: Allow public insert access for contributing study materials (Educational Project)
create policy "Allow public insert access"
    on public.study_materials
    for insert
    with check (true);

-- Policy: Allow public update access for editing materials
create policy "Allow public update access"
    on public.study_materials
    for update
    using (true);

-- Policy: Allow public delete access for removing materials
create policy "Allow public delete access"
    on public.study_materials
    for delete
    using (true);