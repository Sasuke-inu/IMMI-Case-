"""Base scraper with shared HTTP session management and rate limiting."""

import time
import logging
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from ..config import REQUEST_TIMEOUT, REQUEST_DELAY, MAX_RETRIES, USER_AGENT

logger = logging.getLogger(__name__)


class BaseScraper:
    """Base class for all case scrapers with session management and rate limiting."""

    def __init__(self, delay: float = REQUEST_DELAY):
        self.delay = delay
        self.session = self._create_session()
        self._last_request_time = 0.0
        self.last_error: dict | None = None

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-AU,en;q=0.9",
        })
        retry_strategy = Retry(
            total=MAX_RETRIES,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

    def _rate_limit(self):
        """Enforce delay between requests to be respectful to servers."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_request_time = time.time()

    def fetch(self, url: str, params: dict = None) -> requests.Response | None:
        """Fetch a URL with rate limiting and error handling.

        Sets self.last_error with structured info on failure for pipeline use.
        Backward-compatible: existing code checking ``if not response:`` still works.
        """
        self._rate_limit()
        self.last_error = None
        try:
            response = self.session.get(url, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            return response
        except requests.Timeout:
            self.last_error = {"category": "http_timeout", "url": url}
        except requests.ConnectionError as e:
            is_dns = "Name or service not known" in str(e) or "nodename nor servname" in str(e)
            self.last_error = {
                "category": "dns_error" if is_dns else "connection_error",
                "url": url,
                "error": str(e),
            }
        except requests.HTTPError as e:
            status = e.response.status_code if e.response is not None else 0
            self.last_error = {"category": f"http_{status}", "url": url, "status": status}
        except requests.RequestException as e:
            self.last_error = {"category": "request_error", "url": url, "error": str(e)}
        logger.warning(f"Failed to fetch {url}: {self.last_error}")
        return None
