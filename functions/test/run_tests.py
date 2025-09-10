# test/run_tests.py
#!/usr/bin/env python3
"""
Test runner for PDF extraction components
"""
import os
import sys
import argparse

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

def run_all_tests():
    """Run all test suites"""
    from test_pdf_extractor import run_tests as run_pdf_tests
    from test_table_extractor import run_tests as run_table_tests
    
    print("Running PDF Extractor Tests...")
    print("=" * 60)
    pdf_result = run_pdf_tests()
    
    print("\n" + "=" * 60)
    print("Running Table Extractor Tests...")
    print("=" * 60)
    table_result = run_table_tests()
    
    # Combine results
    total_failures = len(pdf_result.failures) + len(table_result.failures)
    total_errors = len(pdf_result.errors) + len(table_result.errors)
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"PDF Extractor Tests: {pdf_result.testsRun} tests run")
    print(f"Table Extractor Tests: {table_result.testsRun} tests run")
    print(f"Total Failures: {total_failures}")
    print(f"Total Errors: {total_errors}")
    
    if total_failures == 0 and total_errors == 0:
        print("All tests passed! ✅")
        return True
    else:
        print("Some tests failed! ❌")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run PDF extraction tests")
    parser.add_argument("--pdf-only", action="store_true", help="Run only PDF extractor tests")
    parser.add_argument("--table-only", action="store_true", help="Run only table extractor tests")
    
    args = parser.parse_args()
    
    if args.pdf_only:
        from test_pdf_extractor import run_tests
        success = run_tests().wasSuccessful()
    elif args.table_only:
        from test_table_extractor import run_tests
        success = run_tests().wasSuccessful()
    else:
        success = run_all_tests()
    
    sys.exit(0 if success else 1)