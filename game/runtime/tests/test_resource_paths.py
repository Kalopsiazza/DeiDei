"""Only source/bundle resource location changes; actual catalog stays identical."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from deidei_runtime import resource_paths


class ResourcePathTests(unittest.TestCase):
    def test_source_reads_existing_catalog(self):
        self.assertEqual(resource_paths.catalog_path(), Path(__file__).resolve().parents[2] / 'desktop/catalog.json')
        self.assertTrue(resource_paths.catalog_path().is_file())

    def test_frozen_uses_only_module_relative_data_and_missing_file_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            module = Path(directory) / 'deidei_runtime/resource_paths.py'
            with patch.object(resource_paths, '__file__', str(module)), patch('sys.frozen', True, create=True):
                expected = module.parent / 'data/catalog.json'
                self.assertEqual(resource_paths.catalog_path(), expected)
                with self.assertRaises(FileNotFoundError):
                    resource_paths.catalog_path().read_text()


if __name__ == '__main__':
    unittest.main()
