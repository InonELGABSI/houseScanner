#!/usr/bin/env python3
"""
LangSmith Tracing Setup

Simple script to verify LangSmith tracing is working.
Only uses LangChain/LangSmith - no other visualization tools.
"""
import os
import logging
from app.core.settings import Settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def check_langsmith_setup():
    """Check if LangSmith tracing is properly configured."""
    print("🔍 LangSmith Configuration Check")
    print("="*40)
    
    settings = Settings()
    
    # Check environment variables
    env_vars = {
        "LANGCHAIN_TRACING_V2": os.getenv("LANGCHAIN_TRACING_V2"),
        "LANGCHAIN_API_KEY": os.getenv("LANGCHAIN_API_KEY", "").replace(settings.LANGCHAIN_API_KEY[10:], "*" * 20) if settings.LANGCHAIN_API_KEY else "Not set",
        "LANGCHAIN_PROJECT": os.getenv("LANGCHAIN_PROJECT"),
        "LANGCHAIN_ENDPOINT": os.getenv("LANGCHAIN_ENDPOINT")
    }
    
    print("📋 Environment Configuration:")
    for key, value in env_vars.items():
        status = "✅" if value and value != "Not set" else "❌"
        print(f"   {status} {key}: {value}")
    
    # Check if tracing is enabled
    tracing_enabled = env_vars["LANGCHAIN_TRACING_V2"] == "true" and env_vars["LANGCHAIN_API_KEY"] != "Not set"
    
    print(f"\n🎯 LangSmith Status:")
    if tracing_enabled:
        print(f"   ✅ LangSmith tracing is ENABLED")
        print(f"   📊 Project: {env_vars['LANGCHAIN_PROJECT']}")
        print(f"   🌐 Dashboard: https://smith.langchain.com/")
        print(f"   📈 Live traces will appear when you run scans")
    else:
        print(f"   ❌ LangSmith tracing is DISABLED")
        print(f"   💡 Check your environment variables")
    
    print(f"\n🚀 Next Steps:")
    print(f"   1. Visit: https://smith.langchain.com/")
    print(f"   2. Login with your LangChain account")
    print(f"   3. Look for project: '{env_vars['LANGCHAIN_PROJECT']}'")
    print(f"   4. Run a scan request to see live traces!")
    
    return tracing_enabled

if __name__ == "__main__":
    check_langsmith_setup()