from scrapy.crawler import CrawlerProcess
from scrapy.utils.project import get_project_settings
from crawler.spiders.domain_spider import DomainSpider
import sys

def start_crawler(start_url, project_id):
    process = CrawlerProcess(get_project_settings())
    process.crawl(DomainSpider, start_url=start_url, project_id=project_id)
    process.start()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python main.py <start_url> <project_id>")
        sys.exit(1)
    
    start_url = sys.argv[1]
    project_id = sys.argv[2]
    start_crawler(start_url, project_id)