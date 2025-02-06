import scrapy
from urllib.parse import urlparse
import dns.resolver
import requests
from datetime import datetime
import asyncio
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

class DomainSpider(scrapy.Spider):
    name = 'domain_spider'
    custom_settings = {
        'CONCURRENT_REQUESTS': 32,
        'DOWNLOAD_DELAY': 1,
        'COOKIES_ENABLED': False,
    }
    
    def __init__(self, start_url=None, project_id=None, *args, **kwargs):
        super(DomainSpider, self).__init__(*args, **kwargs)
        self.start_urls = [start_url] if start_url else []
        self.project_id = project_id
        self.visited_urls = set()
        self.checked_domains = set()
        
        # Initialisation Supabase
        supabase_url = os.getenv('SUPABASE_URL')
        supabase_key = os.getenv('SUPABASE_KEY')
        self.supabase: Client = create_client(supabase_url, supabase_key)

    async def check_domain(self, domain):
        try:
            # Vérification DNS
            answers = dns.resolver.resolve(domain)
            if not answers:
                return True
            
            # Vérification HTTP
            response = requests.head(f"http://{domain}", timeout=5)
            return response.status_code >= 400
            
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return True
        except:
            return False

    def parse(self, response):
        current_url = response.url
        current_domain = urlparse(current_url).netloc
        
        # Enregistrer la page crawlée
        self.supabase.table('crawled_pages').insert({
            'project_id': self.project_id,
            'url': current_url,
            'crawled_at': datetime.now().isoformat(),
            'status': response.status
        }).execute()
        
        # Extraire tous les liens
        for href in response.css('a::attr(href)').getall():
            try:
                absolute_url = response.urljoin(href)
                parsed = urlparse(absolute_url)
                domain = parsed.netloc
                
                # Vérifier les domaines externes
                if domain and domain != current_domain and domain not in self.checked_domains:
                    self.checked_domains.add(domain)
                    
                    # Vérifier si le domaine est expiré
                    is_expired = asyncio.run(self.check_domain(domain))
                    
                    # Enregistrer le domaine vérifié
                    self.supabase.table('checked_domains').insert({
                        'project_id': self.project_id,
                        'domain': domain,
                        'checked_at': datetime.now().isoformat(),
                        'is_expired': is_expired
                    }).execute()
                
                # Continuer le crawling pour les URLs internes
                if parsed.netloc == current_domain and absolute_url not in self.visited_urls:
                    self.visited_urls.add(absolute_url)
                    yield scrapy.Request(absolute_url, callback=self.parse)
                    
            except Exception as e:
                self.logger.error(f"Erreur lors du traitement de l'URL {href}: {str(e)}")