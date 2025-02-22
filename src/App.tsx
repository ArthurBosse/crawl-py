import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Activity, Globe, CheckCircle, XCircle, Play, Loader } from 'lucide-react';

// Initialisation de Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

interface Project {
  id: string;
  name: string;
  start_url: string;
  created_at: string;
  status?: 'idle' | 'running';
}

interface CrawledPage {
  url: string;
  crawled_at: string;
  status: number;
}

interface CheckedDomain {
  domain: string;
  checked_at: string;
  is_expired: boolean;
}

function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [crawledPages, setCrawledPages] = useState<CrawledPage[]>([]);
  const [checkedDomains, setCheckedDomains] = useState<CheckedDomain[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectUrl, setNewProjectUrl] = useState('');
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchProjects();
    const projectsSubscription = supabase
      .channel('projects')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchProjects)
      .subscribe();

    return () => {
      supabase.removeChannel(projectsSubscription);
    };
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchProjectData(selectedProject);
      const dataSubscription = supabase
        .channel('project_data')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'crawled_pages' }, () => fetchProjectData(selectedProject))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'checked_domains' }, () => fetchProjectData(selectedProject))
        .subscribe();

      return () => {
        supabase.removeChannel(dataSubscription);
      };
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    const { data } = await supabase.from('projects').select('*');
    if (data) setProjects(data);
  };

  const fetchProjectData = async (projectId: string) => {
    const { data: pages } = await supabase
      .from('crawled_pages')
      .select('*')
      .eq('project_id', projectId);
    if (pages) setCrawledPages(pages);

    const { data: domains } = await supabase
      .from('checked_domains')
      .select('*')
      .eq('project_id', projectId);
    if (domains) setCheckedDomains(domains);
  };

  const createNewProject = async () => {
    const { data, error } = await supabase
      .from('projects')
      .insert([{ name: newProjectName, start_url: newProjectUrl }])
      .select();

    if (!error && data) {
      setNewProjectName('');
      setNewProjectUrl('');
      fetchProjects();
    }
  };

  const startCrawler = async (projectId: string, startUrl: string) => {
    setLoading(prev => ({ ...prev, [projectId]: true }));
    try {
      const response = await fetch('/api/start-crawler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          startUrl,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du démarrage du crawler');
      }
      
      // Mettre à jour le statut du projet
      const updatedProjects = projects.map(p => 
        p.id === projectId ? { ...p, status: 'running' } : p
      );
      setProjects(updatedProjects);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors du démarrage du crawler');
    } finally {
      setLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Activity className="h-8 w-8 text-indigo-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">Domain Crawler</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 gap-6">
          {/* Nouveau projet */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Nouveau Projet</h2>
            <div className="grid grid-cols-1 gap-4">
              <input
                type="text"
                placeholder="Nom du projet"
                className="border rounded p-2"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
              />
              <input
                type="url"
                placeholder="URL de départ"
                className="border rounded p-2"
                value={newProjectUrl}
                onChange={(e) => setNewProjectUrl(e.target.value)}
              />
              <button
                onClick={createNewProject}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Créer le projet
              </button>
            </div>
          </div>

          {/* Liste des projets */}
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Projets</h2>
            <div className="grid grid-cols-1 gap-4">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`p-4 rounded-lg border ${
                    selectedProject === project.id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Globe className="h-5 w-5 text-indigo-600 mr-2" />
                      <div>
                        <span className="font-medium">{project.name}</span>
                        <div className="text-sm text-gray-500">{project.start_url}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedProject(project.id)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Détails
                      </button>
                      <button
                        onClick={() => startCrawler(project.id, project.start_url)}
                        disabled={loading[project.id] || project.status === 'running'}
                        className={`flex items-center px-3 py-1 text-sm rounded ${
                          loading[project.id] || project.status === 'running'
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {loading[project.id] ? (
                          <Loader className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        {project.status === 'running' ? 'En cours' : 'Démarrer'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Données du projet sélectionné */}
          {selectedProject && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Pages crawlées */}
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Pages Crawlées</h3>
                <div className="overflow-y-auto max-h-96">
                  {crawledPages.map((page, index) => (
                    <div key={index} className="border-b py-2">
                      <div className="text-sm">{page.url}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(page.crawled_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Domaines vérifiés */}
              <div className="bg-white shadow-sm rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Domaines Vérifiés</h3>
                <div className="overflow-y-auto max-h-96">
                  {checkedDomains.map((domain, index) => (
                    <div key={index} className="border-b py-2 flex items-center">
                      {domain.is_expired ? (
                        <XCircle className="h-5 w-5 text-red-500 mr-2" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      )}
                      <div>
                        <div className="text-sm">{domain.domain}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(domain.checked_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;