import unittest
import importlib.util
from pathlib import Path
from integrate import needs_processing

spec=importlib.util.spec_from_file_location('sync_generations',Path(__file__).with_name('sync-generations.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class ContinuousPolicyTest(unittest.TestCase):
    def test_replay_targets_only_collision_receipts_until_reviewed(self):
        previous={'mapping_sha256':'mapped','allow_recent':True,'quarantine_reasons':{'input_identity_collision':7}}
        self.assertTrue(needs_processing(previous,True,'mapped','binary-equivalent-v1'))
        self.assertFalse(needs_processing(previous|{'identity_policy':'binary-equivalent-v1'},True,'mapped','binary-equivalent-v1'))
        self.assertFalse(needs_processing(previous|{'quarantine_reasons':{'existing_identity_or_metadata_conflict':7}},True,'mapped','binary-equivalent-v1'))

    def test_continuous_import_waits_for_completed_article_tables(self):
        plan={'mappingSha256':'mapped','tables':[{'table':'tag_a','action':'import_articles'},{'table':'tag_b','action':'import_articles'},{'table':'show_cache','action':'nearline_only'}]}
        source={'tables':{'tag_a':{'status':'complete','chunks':[{'sha256':'hash'}]},'tag_b':{'status':'running','chunks':[{'sha256':'hash2'}]},'show_cache':{'status':'complete','chunks':[{'sha256':'hash3'}]}}}
        self.assertEqual(module.pending_chunks(plan,{'completed':{}},source,'binary-equivalent-v1'),[('tag_a',0)])
